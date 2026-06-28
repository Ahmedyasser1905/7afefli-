import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/barber/SalonSetupScreen.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import { WebView } from 'react-native-webview';
import { WILAYAS } from '@barberdz/shared/constants/wilayas';
import { useTranslations } from '../../hooks/useTranslations';

export function SalonSetupScreen({ onComplete, existingSalon }: { onComplete: () => void, existingSalon?: any }) {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { t } = useTranslations();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [wilayaPickerVisible, setWilayaPickerVisible] = useState(false);

  const [form, setForm] = useState({
    name: existingSalon?.name || '',
    description: existingSalon?.description || '',
    wilaya: existingSalon?.wilaya || 'Alger',
    commune: existingSalon?.commune || '',
    address: existingSalon?.address || '',
    phone: existingSalon?.phone || '',
    open_time: existingSalon?.open_time?.substring(0, 5) || '09:00',
    close_time: existingSalon?.close_time?.substring(0, 5) || '20:00',
    working_days: existingSalon?.working_days || [1, 2, 3, 4, 5, 6],
    latitude: existingSalon?.latitude ?? 36.7538,
    longitude: existingSalon?.longitude ?? 3.0588,
  });

  const [coordsChosen, setCoordsChosen] = useState(
    !!(existingSalon && existingSalon.latitude !== null && existingSalon.latitude !== undefined && existingSalon.latitude !== 36.7538)
  );

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter((d: number) => d !== day)
        : [...prev.working_days, day].sort()
    }));
  };

  const handleCreateSalon = async () => {
    if (!form.name || !form.address || !form.wilaya || !form.commune || !form.phone) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: t('setup.fill_required')
      });
      return;
    }

    // A-5/COIF-1 fix: Block submission if user never placed the pin on the map.
    // coordsChosen is set to true only when the user explicitly taps a point on the WebView map.
    // If they skip the map step entirely, the default Algiers coordinates (36.7538, 3.0588)
    // would silently be submitted and the salon would appear at the wrong location.
    const DEFAULT_LAT = 36.7538;
    const DEFAULT_LNG = 3.0588;
    const coordsAreDefault =
      Math.abs(form.latitude - DEFAULT_LAT) < 0.0001 &&
      Math.abs(form.longitude - DEFAULT_LNG) < 0.0001;

    if (!coordsChosen || coordsAreDefault) {
      Alert.alert(
        t('setup.location_required'),
        t('setup.place_on_map'),
      );
      return;
    }

    // Validate Algeria bounding box instead of requiring explicit map interaction
    // This allows barbers whose salon IS at Algiers default coords to submit freely
    const ALG_BOUNDS = { minLat: 18, maxLat: 38, minLng: -9, maxLng: 12 };
    const coordsValid =
      form.latitude >= ALG_BOUNDS.minLat && form.latitude <= ALG_BOUNDS.maxLat &&
      form.longitude >= ALG_BOUNDS.minLng && form.longitude <= ALG_BOUNDS.maxLng;
    if (!coordsValid) {
      Alert.alert(t('setup.invalid_location'), t('setup.invalid_location_msg'));
      return;
    }

    setLoading(true);
    try {
      if (existingSalon?.id) {
        await apiClient.patch(`/salons/${existingSalon.id}`, {
          name: form.name,
          description: form.description || undefined,
          wilaya: form.wilaya,
          commune: form.commune,
          address: form.address,
          phone: form.phone,
          open_time: form.open_time,
          close_time: form.close_time,
          latitude: form.latitude,
          longitude: form.longitude,
          working_days: form.working_days,
        });
        // Invalidate client-facing caches so updated salon appears on map immediately
        queryClient.invalidateQueries({ queryKey: ['home-salons-nearby'] });
        queryClient.invalidateQueries({ queryKey: ['explore-explore-salons'] });
        queryClient.invalidateQueries({ queryKey: ['nearby-salons'] });
        queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
        Alert.alert(t('common.success'), t('setup.updated_success'), [
          { text: t('setup.continue'), onPress: onComplete }
        ]);
      } else {
        await apiClient.post('/salons', {
          name: form.name,
          description: form.description || undefined,
          wilaya: form.wilaya,
          commune: form.commune,
          address: form.address,
          phone: form.phone,
          open_time: form.open_time,
          close_time: form.close_time,
          latitude: form.latitude,
          longitude: form.longitude,
          working_days: form.working_days,
        });
        // Invalidate client-facing caches so new salon appears on map immediately
        queryClient.invalidateQueries({ queryKey: ['home-salons-nearby'] });
        queryClient.invalidateQueries({ queryKey: ['explore-explore-salons'] });
        queryClient.invalidateQueries({ queryKey: ['nearby-salons'] });
        queryClient.invalidateQueries({ queryKey: ['my-salon', user?.id] });
        Alert.alert(t('common.success'), t('setup.created_success'), [
          { text: t('setup.continue'), onPress: onComplete }
        ]);
      }
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: (err as Error)?.message ?? t('setup.generic_error')
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoized map HTML — compiled exactly once from initial coordinates.
  // Updates flow via postMessage/onMessage — NOT by re-rendering the HTML.
  // Without useMemo([]), editing other form fields (name, phone, etc.) would
  // cause the WebView to reload entirely, creating a jarring flicker.
  const initialLat = form.latitude;
  const initialLng = form.longitude;

  const mapHtml = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #0F0F0F; }
    #map { width: 100%; height: 100vh; }
    .leaflet-control-zoom { border: none !important; }
    .leaflet-control-zoom a {
      background: #1A1A1A !important;
      color: #E8A020 !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      width: 36px !important;
      height: 36px !important;
      line-height: 36px !important;
      font-size: 18px !important;
    }
    .search-box {
      position: absolute; top: 12px; left: 12px; right: 12px; z-index: 1000;
      display: flex; gap: 8px;
    }
    .search-box input {
      flex: 1; padding: 10px 14px; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1); background: #1A1A1A;
      color: #F5F5F5; font-size: 14px; outline: none;
      font-family: -apple-system, sans-serif;
    }
    .search-box input::placeholder { color: #5A5A5A; }
    .search-box button {
      padding: 10px 16px; border-radius: 12px; border: none;
      background: #E8A020; color: #0F0F0F; font-weight: 700;
      font-size: 14px; cursor: pointer;
    }
    .hint-bar {
      position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 1000;
      background: rgba(26,26,26,0.9); border-radius: 12px; padding: 10px 14px;
      border: 1px solid rgba(255,255,255,0.1); text-align: center;
    }
    .hint-bar span { color: #9A9A9A; font-size: 13px; font-family: -apple-system, sans-serif; }
    .hint-bar b { color: #E8A020; }
  </style>
</head>
<body>
  <div class="search-box">
    <input id="searchInput" type="text" placeholder="Rechercher une adresse..." />
    <button onclick="searchAddress()">🔍</button>
  </div>
  <div id="map"></div>
  <div class="hint-bar">
    <span>Appuyez sur la carte ou <b>déplacez le marqueur</b> pour positionner votre salon</span>
  </div>
  <script>
    var map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: 15,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OSM'
    }).addTo(map);

    var markerIcon = L.divIcon({
      className: '',
      html: '<div style="width:36px;height:36px;background:#E8A020;border-radius:50%;border:3px solid #0F0F0F;box-shadow:0 4px 12px rgba(232,160,32,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:#0F0F0F;border-radius:50%;"></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    var marker = L.marker([${initialLat}, ${initialLng}], { icon: markerIcon, draggable: true }).addTo(map);

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
    });

    function searchAddress() {
      var q = document.getElementById('searchInput').value;
      if (!q) return;
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q + ', Algeria'))
        .then(r => r.json())
        .then(data => {
          if (data.length > 0) {
            var loc = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
            map.setView(loc, 16);
            marker.setLatLng(loc);
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: loc[0], lng: loc[1] }));
          }
        })
        .catch(function() {});
    }

    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchAddress();
    });
  </script>
</body>
</html>
  `, []); // empty deps — only uses initial coords, updates flow via postMessage

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {(step === 2 || navigation.canGoBack()) ? (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => {
              if (step === 2) {
                setStep(1);
              } else {
                navigation.goBack();
              }
            }} 
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.amber} />
          </TouchableOpacity>
        ) : (
          <View style={{ height: 40, marginBottom: spacing.md }} />
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{t('setup.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {step === 1 ? t('setup.step1') : t('setup.step2')}
          </Text>
        </View>
      </View>

      {step === 1 ? (
        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{t('setup.salon_name')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Barber Shop VIP"
            placeholderTextColor={colors.textMuted}
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />


          <Text style={styles.label}>{t('setup.description')}</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
            placeholder="Ex: Salon moderne, coupes tendance..."
            placeholderTextColor={colors.textMuted}
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>{t('setup.wilaya')}</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setWilayaPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={form.wilaya ? styles.pickerValue : styles.pickerPlaceholder}>
              {form.wilaya || t('setup.select_wilaya')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <Modal visible={wilayaPickerVisible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t('setup.select_wilaya')}</Text>
                <FlatList
                  data={WILAYAS as unknown as string[]}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.wilayaItem, form.wilaya === item && styles.wilayaItemActive]}
                      onPress={() => {
                        setForm(prev => ({ ...prev, wilaya: item }));
                        setWilayaPickerVisible(false);
                      }}
                    >
                      <Text style={[styles.wilayaItemText, form.wilaya === item && styles.wilayaItemTextActive]}>
                        {item}
                      </Text>
                      {form.wilaya === item && <Ionicons name="checkmark" size={18} color={colors.amber} />}
                    </TouchableOpacity>
                  )}
                />
                <TouchableOpacity style={styles.modalCancel} onPress={() => setWilayaPickerVisible(false)}>
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={styles.label}>{t('setup.commune')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Bab El Oued"
            placeholderTextColor={colors.textMuted}
            value={form.commune}
            onChangeText={(t) => setForm({ ...form, commune: t })}
          />

          <Text style={styles.label}>{t('setup.address')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 12 Rue Didouche Mourad"
            placeholderTextColor={colors.textMuted}
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />

          <Text style={styles.label}>{t('setup.phone')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 0550123456"
            placeholderTextColor={colors.textMuted}
            value={form.phone}
            onChangeText={(t) => setForm({ ...form, phone: t })}
            keyboardType="phone-pad"
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('setup.open_time')}</Text>
              <TextInput
                style={styles.input}
                placeholder="09:00"
                placeholderTextColor={colors.textMuted}
                value={form.open_time}
                onChangeText={(t) => setForm({ ...form, open_time: t })}
              />
            </View>
            <View style={{ width: spacing.md }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('setup.close_time')}</Text>
              <TextInput
                style={styles.input}
                placeholder="20:00"
                placeholderTextColor={colors.textMuted}
                value={form.close_time}
                onChangeText={(t) => setForm({ ...form, close_time: t })}
              />
            </View>
          </View>

          <Text style={styles.label}>{t('setup.working_days')}</Text>
          <View style={styles.daysRow}>
            {[t('setup.day_mon'), t('setup.day_tue'), t('setup.day_wed'), t('setup.day_thu'), t('setup.day_fri'), t('setup.day_sat'), t('setup.day_sun')].map((label, index) => {
              const dayNum = index + 1;
              const isSelected = form.working_days.includes(dayNum);
              return (
                <TouchableOpacity
                  key={dayNum}
                  style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                  onPress={() => toggleDay(dayNum)}
                >
                  <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.mapContainer}>
          <Text style={styles.mapHint}>{t('setup.map_hint')}</Text>
          <View style={styles.mapWrapper}>
            <WebView
              source={{ html: mapHtml }}
              style={styles.map}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.lat !== undefined && data.lng !== undefined) {
                    setForm(prev => ({
                      ...prev,
                      latitude: data.lat,
                      longitude: data.lng,
                    }));
                    setCoordsChosen(true);
                  }
                } catch (err) {}
              }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
            />
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {step === 2 && (
          <TouchableOpacity 
            style={[styles.button, styles.buttonOutline]} 
            onPress={() => setStep(1)}
          >
            <Text style={styles.buttonOutlineText}>{t('setup.back')}</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => step === 1 ? setStep(2) : handleCreateSalon()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.buttonText}>{step === 1 ? t('setup.next') : t('setup.finish')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    padding: spacing.xl,
    paddingBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: spacing.md,
  },
  titleContainer: {
    marginTop: spacing.xs,
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 28,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayButtonSelected: {
    backgroundColor: colors.amber,
    borderColor: colors.amber,
  },
  dayText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayTextSelected: {
    color: colors.ink,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  mapHint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  mapWrapper: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  map: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  footer: {
    padding: spacing.xl,
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
    backgroundColor: colors.amber,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.amber,
  },
  buttonOutlineText: {
    fontFamily: 'Syne_700Bold',
    fontSize: 16,
    color: colors.amber,
  },
  pickerButton: {
    backgroundColor: colors.carbon,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    height: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: {
    color: colors.textPrimary,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.carbon,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.textPrimary,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  wilayaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  wilayaItemActive: {
    backgroundColor: 'rgba(232,160,32,0.08)',
  },
  wilayaItemText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    color: colors.textPrimary,
  },
  wilayaItemTextActive: {
    color: colors.amber,
    fontFamily: 'DMSans_700Bold',
  },
  modalCancel: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  modalCancelText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: colors.textSecondary,
  },
});
