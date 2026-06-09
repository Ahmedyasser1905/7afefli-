// @ts-nocheck
import Toast from 'react-native-toast-message';
// apps/mobile/src/screens/barber/SalonSetupScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { colors, typography, spacing, radius } from '../../theme';
import Ionicons from "@react-native-vector-icons/ionicons";
import MapView, { Marker } from 'react-native-maps';

export function SalonSetupScreen({ onComplete }: { onComplete: () => void }) {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    name: '',
    description: '',
    wilaya: 'Alger',
    address: '',
    open_time: '09:00',
    close_time: '20:00',
    working_days: [1, 2, 3, 4, 5, 6],
    latitude: 36.7538,
    longitude: 3.0588,
  });

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort()
    }));
  };

  const handleCreateSalon = async () => {
    if (!form.name || !form.address) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Veuillez remplir tous les champs'
      });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/salons', {
        name: form.name,
        description: form.description || undefined,
        wilaya: form.wilaya,
        address: form.address,
        open_time: form.open_time,
        close_time: form.close_time,
        latitude: form.latitude,
        longitude: form.longitude,
        working_days: form.working_days,
      });
      
      Alert.alert('Succès', 'Votre salon a été créé avec succès !', [
        { text: 'Continuer', onPress: onComplete }
      ]);
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #1a1a2e; }
        #map { width: 100vw; height: 100vh; }
        .leaflet-tile-pane { filter: brightness(0.7) contrast(1.2) saturate(0.3) hue-rotate(180deg) invert(1); }
        .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
        .marker {
          width: 32px; height: 32px; background: #E8A020; border-radius: 50%;
          border: 2.5px solid #0F0F0F; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 10px rgba(232,160,32,0.6);
        }
        /* Custom Geocoder styles for dark theme */
        .leaflet-control-geocoder { background: #1A1A1A !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 8px !important; margin-top: 20px !important; margin-right: 20px !important; }
        .leaflet-control-geocoder-icon { background-color: transparent !important; filter: invert(1); }
        .leaflet-control-geocoder-form input { background: transparent; color: #fff; }
        .leaflet-control-geocoder-form input:focus { outline: none; }
        .leaflet-control-geocoder-alternatives { background: #1A1A1A !important; color: #fff; border-top: 1px solid rgba(255,255,255,0.1); }
        .leaflet-control-geocoder-alternatives li:hover { background: #333 !important; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { center: [${form.latitude}, ${form.longitude}], zoom: 12, zoomControl: false });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        var icon = L.divIcon({
          html: '<div class="marker"><svg viewBox="0 0 24 24" fill="#111" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
          className: '', iconSize: [32, 32], iconAnchor: [16, 32]
        });
        
        var marker = L.marker([${form.latitude}, ${form.longitude}], { icon: icon, draggable: true }).addTo(map);
        
        // Add Geocoder (Search Box)
        var geocoder = L.Control.geocoder({
          defaultMarkGeocode: false,
          placeholder: "Rechercher une adresse...",
          position: "topright"
        }).on('markgeocode', function(e) {
          var latlng = e.geocode.center;
          map.setView(latlng, 15);
          marker.setLatLng(latlng);
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
        }).addTo(map);

        marker.on('dragend', function(e) {
          var pos = marker.getLatLng();
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
        });

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latlng.lat, lng: e.latlng.lng }));
        });
      </script>
    </body>
    </html>
  `;

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
          <Text style={styles.headerTitle}>Configuration du Salon</Text>
          <Text style={styles.headerSubtitle}>
            {step === 1 ? 'Informations générales' : 'Emplacement sur la carte'}
          </Text>
        </View>
      </View>

      {step === 1 ? (
        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nom du salon</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Barber Shop VIP"
            placeholderTextColor={colors.textMuted}
            value={form.name}
            onChangeText={(t) => setForm({ ...form, name: t })}
          />


          <Text style={styles.label}>Description (optionnel)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
            placeholder="Ex: Salon moderne, coupes tendance..."
            placeholderTextColor={colors.textMuted}
            value={form.description}
            onChangeText={(t) => setForm({ ...form, description: t })}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.label}>Wilaya</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Alger"
            placeholderTextColor={colors.textMuted}
            value={form.wilaya}
            onChangeText={(t) => setForm({ ...form, wilaya: t })}
          />

          <Text style={styles.label}>Adresse complète</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 12 Rue Didouche Mourad"
            placeholderTextColor={colors.textMuted}
            value={form.address}
            onChangeText={(t) => setForm({ ...form, address: t })}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Heure d'ouverture</Text>
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
              <Text style={styles.label}>Heure de fermeture</Text>
              <TextInput
                style={styles.input}
                placeholder="20:00"
                placeholderTextColor={colors.textMuted}
                value={form.close_time}
                onChangeText={(t) => setForm({ ...form, close_time: t })}
              />
            </View>
          </View>

          <Text style={styles.label}>Jours d'ouverture</Text>
          <View style={styles.daysRow}>
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((label, index) => {
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
          <Text style={styles.mapHint}>Déplacez le marqueur ou cliquez sur la carte pour définir votre position exacte.</Text>
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: form.latitude,
                longitude: form.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              onPress={(e) => {
                setForm({
                  ...form,
                  latitude: e.nativeEvent.coordinate.latitude,
                  longitude: e.nativeEvent.coordinate.longitude,
                });
              }}
            >
              <Marker coordinate={{ latitude: form.latitude, longitude: form.longitude }} />
            </MapView>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        {step === 2 && (
          <TouchableOpacity 
            style={[styles.button, styles.buttonOutline]} 
            onPress={() => setStep(1)}
          >
            <Text style={styles.buttonOutlineText}>Retour</Text>
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
            <Text style={styles.buttonText}>{step === 1 ? 'Suivant' : 'Terminer'}</Text>
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
});
