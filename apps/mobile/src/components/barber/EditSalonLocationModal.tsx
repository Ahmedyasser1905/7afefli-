import Toast from 'react-native-toast-message';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../lib/apiClient';

interface EditSalonLocationModalProps {
  visible: boolean;
  onClose: () => void;
  salon: any;
  onSaved: () => void;
}

export function EditSalonLocationModal({ visible, onClose, salon, onSaved }: EditSalonLocationModalProps) {
  const [lat, setLat] = useState(36.7538);
  const [lng, setLng] = useState(3.0588);
  const [saving, setSaving] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (salon && visible) {
      setLat((salon.latitude as number) ?? 36.7538);
      setLng((salon.longitude as number) ?? 3.0588);
    }
  }, [salon, visible]);

  const handleSave = async () => {
    if (!salon) return;
    setSaving(true);
    try {
      await apiClient.patch(`/salons/${salon.id}`, {
        latitude: lat,
        longitude: lng,
      });

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Emplacement mis à jour'
      });
      onSaved();
      onClose();
    } catch (err: unknown) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: (err as Error).message || 'Impossible de sauvegarder l\'emplacement'
      });
    } finally {
      setSaving(false);
    }
  };

  const mapHtml = `
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
      center: [${lat}, ${lng}],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OSM',
    }).addTo(map);

    var markerIcon = L.divIcon({
      className: '',
      html: '<div style="width:36px;height:36px;background:#E8A020;border-radius:50%;border:3px solid #0F0F0F;box-shadow:0 4px 12px rgba(232,160,32,0.4);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;background:#0F0F0F;border-radius:50%;"></div></div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    var marker = L.marker([${lat}, ${lng}], { icon: markerIcon, draggable: true }).addTo(map);

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
        .catch(function() { /* Search failed silently */ });
    }

    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') searchAddress();
    });
  </script>
</body>
</html>`;

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      // Use explicit undefined check to allow 0,0 (null island) coordinates
      if (data.lat !== undefined && data.lng !== undefined) {
        setLat(data.lat);
        setLng(data.lng);
      }
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Emplacement du salon</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving} activeOpacity={0.7}>
            {saving ? (
              <ActivityIndicator color={colors.amber} size="small" />
            ) : (
              <Ionicons name="checkmark" size={24} color={colors.amber} />
            )}
          </TouchableOpacity>
        </View>

        {/* Coords Display */}
        <View style={styles.coordsBar}>
          <Ionicons name="navigate" size={14} color={colors.amber} />
          <Text style={styles.coordsText}>
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </Text>
        </View>

        {/* Map */}
        <WebView
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 50,
    paddingBottom: spacing.md,
    backgroundColor: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.carbon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 17,
    color: colors.textPrimary,
  },
  coordsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.carbon,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  coordsText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: colors.textSecondary,
  },
  map: {
    flex: 1,
  },
});
