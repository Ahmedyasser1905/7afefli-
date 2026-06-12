// apps/mobile/src/components/map/SalonMapView.tsx
// Map with Google Maps-style rotation (MapLibre GL) + Leaflet fallback
// Stable: mapHtml is compiled exactly once. Salon and location updates are injected dynamically.

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors } from '../../theme';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { Salon } from '@barberdz/shared/types';

interface SalonMapViewProps {
  salons: Salon[];
  userLocation: { latitude: number; longitude: number } | null;
  onSalonPress?: (salonId: string) => void;
  onMarkerClick?: (salonId: string) => void;
  onPopupClose?: () => void;
  selectedSalonId?: string | null;
  height?: number;
  style?: unknown;
}

// Default center: Algiers
const DEFAULT_LAT = 36.7538;
const DEFAULT_LNG = 3.0588;

export function SalonMapView({
  salons,
  userLocation,
  onSalonPress,
  onMarkerClick,
  onPopupClose,
  selectedSalonId,
  height = 250,
  style,
}: SalonMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const hasCenteredOnUser = useRef(false);

  // Keep latest userLocation in a ref so callbacks never go stale
  const userLocationRef = useRef(userLocation);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  const zoomIn = useCallback(() => {
    webViewRef.current?.injectJavaScript('if(window.map)map.zoomIn();true;');
  }, []);

  const zoomOut = useCallback(() => {
    webViewRef.current?.injectJavaScript('if(window.map)map.zoomOut();true;');
  }, []);

  const resetView = useCallback(() => {
    const loc = userLocationRef.current;
    const lng = loc?.longitude ?? DEFAULT_LNG;
    const lat = loc?.latitude ?? DEFAULT_LAT;
    webViewRef.current?.injectJavaScript(
      `if(window.map){try{map.easeTo({center:[${lng},${lat}],zoom:12,bearing:0,pitch:0,duration:400})}catch(e){map.setView([${lat},${lng}],12)}}true;`
    );
  }, []);

  // ── Serialize salons dynamically — only trigger injection when salons change ──
  const serializedSalons = useMemo(() => {
    const salonsData = salons
      .filter((s) => s.latitude && s.longitude && s.latitude !== 0 && s.longitude !== 0)
      .map((s) => ({
        id: s.id,
        name: s.name || 'Salon',
        rating: s.average_rating?.toFixed(1) || 'Nouveau',
        wilaya: s.wilaya || '',
        lng: s.longitude,
        lat: s.latitude,
      }));
    return JSON.stringify(salonsData);
  }, [salons]);

  // ── Inject salons when map is ready or salons change ──
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const encoded = encodeURIComponent(serializedSalons);
    webViewRef.current.injectJavaScript(
      `if(window.updateSalons){window.updateSalons(JSON.parse(decodeURIComponent("${encoded}")));}true;`
    );
  }, [serializedSalons, mapReady]);

  // ── Inject selection when active salon changes ──
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    const encodedId = encodeURIComponent(JSON.stringify(selectedSalonId || null));
    webViewRef.current.injectJavaScript(
      `if(window.selectSalon){window.selectSalon(JSON.parse(decodeURIComponent("${encodedId}")));}true;`
    );
  }, [selectedSalonId, mapReady]);

  // ── Static HTML string - compiled exactly ONCE ──
  const mapHtml = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#1a1a2e}
#map{width:100%;height:100%}
#status{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#888;font-family:sans-serif;font-size:13px;text-align:center;width:80%}
.marker{width:32px;height:32px;background:#E8A020;border-radius:50%;border:2.5px solid #0F0F0F;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(232,160,32,0.6);cursor:pointer}
.marker:active{opacity:0.85}
.marker svg{width:16px;height:16px;pointer-events:none}
.user-dot{width:14px;height:14px;background:#4A90D9;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 0 4px rgba(74,144,217,0.2)}
.maplibregl-ctrl-attrib{display:none!important}
.maplibregl-popup-content{border-radius:14px;padding:14px;font-family:sans-serif;background:#1a1a2e;color:#eee;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 20px rgba(0,0,0,0.5)}
.maplibregl-popup-tip{border-top-color:#1a1a2e}
.maplibregl-popup-close-button{color:#666;font-size:20px;padding:4px 8px}
.p-name{font-size:14px;font-weight:700;color:#fff;margin-bottom:3px}
.p-info{font-size:12px;color:#aaa;margin-bottom:8px}
.p-actions{display:flex;gap:8px;flex-wrap:wrap}
.p-btn{display:inline-flex;align-items:center;padding:6px 12px;border-radius:20px;font-size:11px;font-weight:600;text-decoration:none;border:none;cursor:pointer}
.p-view{background:#E8A020;color:#111}
.p-dir{background:#4A90D9;color:#fff}
.leaflet-tile-pane{filter:brightness(0.7) contrast(1.2) saturate(0.3) hue-rotate(180deg) invert(1)}
.leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
.leaflet-popup-content-wrapper{border-radius:14px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 20px rgba(0,0,0,0.5)}
.leaflet-popup-content{margin:12px 14px;font-family:sans-serif;color:#eee}
.leaflet-popup-tip{border-top-color:#1a1a2e}
.leaflet-popup-close-button{color:#666;font-size:18px}
</style>
<script>
// Webview diagnostic error logging
window.onerror = function(msg, url, line, col, error) {
  var extra = msg + "\\nline: " + line + (col ? ", col: " + col : "");
  if (error && error.stack) {
    extra += "\\nstack: " + error.stack;
  }
  var statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.style.display = 'block';
    statusDiv.style.color = '#ff6b6b';
    statusDiv.innerHTML = '<strong>Erreur JS Carte:</strong><br><pre style="text-align:left;white-space:pre-wrap;font-size:10px;margin-top:10px;color:#ff8b8b;max-height:150px;overflow:auto">' + extra + '</pre>';
  }
  return false;
};

function notifyReady() {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage('MAP_READY');
  } else {
    setTimeout(notifyReady, 200);
  }
}

function safePostMessage(msg) {
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(msg);
  }
}
</script>
</head>
<body>
<div id="map"></div>
<div id="status">Initialisation de la carte...</div>
<script>
var DATA=[];
var ULNG=${DEFAULT_LNG};
var ULAT=${DEFAULT_LAT};
var HAS_USER=false;
var routeLayer=null;
var userMarker=null;
var salonMarkers=[];
var currentPopup=null;

var scissorsSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23111"><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/></svg>';

function drawRouteOSRM(lng,lat){
  var url='https://router.project-osrm.org/route/v1/driving/'+ULNG+','+ULAT+';'+lng+','+lat+'?overview=full&geometries=geojson';
  return fetch(url).then(function(r){return r.json()}).then(function(d){
    return d.routes&&d.routes[0]?d.routes[0].geometry.coordinates:[[ULNG,ULAT],[lng,lat]];
  }).catch(function(){return[[ULNG,ULAT],[lng,lat]]});
}

function loadScript(url,cb,fb){
  var s=document.createElement('script');
  s.src=url;
  s.onload=cb;
  s.onerror=function(e) {
    console.error("Script load error: " + url, e);
    fb();
  };
  document.head.appendChild(s);
}
function loadCSS(url){
  var l=document.createElement('link');l.rel='stylesheet';l.href=url;
  document.head.appendChild(l);
}

function hasWebGL(){
  try{
    var c=document.createElement('canvas');
    var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    return !!gl;
  }catch(e){
    return false;
  }
}

if(hasWebGL()){
  loadCSS('https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css');
  loadScript('https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js', initMapLibre, initLeaflet);
} else {
  initLeaflet();
}

function initMapLibre(){
  try {
    var map=window.map=new maplibregl.Map({
      container:'map',
      style:{
        version:8,
        sources:{'osm':{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19}},
        layers:[{id:'osm',type:'raster',source:'osm',paint:{'raster-brightness-max':0.55,'raster-contrast':0.2,'raster-saturation':-0.5}}]
      },
      center:[ULNG,ULAT],
      zoom:12,
      dragRotate:true,
      touchZoomRotate:true,
      touchPitch:true,
      attributionControl:false
    });

    document.getElementById('status').style.display='none';

    map.on('load', function() {
      notifyReady();
    });

    window.updateUserLocation = function(lng, lat) {
      ULNG = lng;
      ULAT = lat;
      HAS_USER = true;
      if (userMarker) {
        userMarker.setLngLat([lng, lat]);
      } else {
        var uel=document.createElement('div');uel.className='user-dot';
        userMarker=new maplibregl.Marker({element:uel}).setLngLat([lng, lat]).addTo(map);
      }
    };

    window.flyToUser = function(lng, lat) {
      map.easeTo({center:[lng,lat],zoom:13,duration:800});
    };

    window.updateSalons = function(salonsData) {
      // Close any open popup before rebuilding markers
      if (currentPopup) { currentPopup.remove(); currentPopup = null; }
      DATA = salonsData || [];
      salonMarkers.forEach(function(m){m.remove()});
      salonMarkers = [];

      DATA.forEach(function(s){
        var el=document.createElement('div');el.className='marker';el.innerHTML=scissorsSvg;
        el.setAttribute('data-sid', s.id);
        el.onclick=function(e){
          e.stopPropagation();
          safePostMessage(JSON.stringify({type:'MARKER_CLICK', salonId:s.id}));
        };
        var m = new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([s.lng,s.lat]).addTo(map);
        salonMarkers.push(m);
      });

      if(DATA.length>0){
        var b=new maplibregl.LngLatBounds([DATA[0].lng,DATA[0].lat],[DATA[0].lng,DATA[0].lat]);
        DATA.forEach(function(s){b.extend([s.lng,s.lat])});
        map.fitBounds(b,{padding:50,maxZoom:14});
      }
    };

    window.selectSalon = function(salonId) {
      if(currentPopup) { currentPopup.remove(); currentPopup = null; }
      if(!salonId) return;
      var s = DATA.find(function(item){return item.id === salonId;});
      if(!s) return;
      map.easeTo({center:[s.lng,s.lat],zoom:14,duration:600});
      
      var dirBtn=HAS_USER?'<button class="p-btn p-dir" onclick="mglRoute('+s.lng+','+s.lat+')">Itin\u00e9raire</button>':'';
      currentPopup = new maplibregl.Popup({offset:18,closeButton:true,maxWidth:'240px'})
        .setLngLat([s.lng,s.lat])
        .setHTML('<div class="p-name">'+s.name+'</div><div class="p-info">\u2B50 '+s.rating+' \u00B7 '+s.wilaya+'</div><div class="p-actions"><button class="p-btn p-view" onclick="safePostMessage(JSON.stringify({type:\\\'SALON_PRESS\\\', salonId:\\\''+s.id+'\\\'}))">Voir salon</button>'+dirBtn+'</div>')
        .addTo(map);
        
      currentPopup.on('close', function() {
        safePostMessage(JSON.stringify({type:'POPUP_CLOSE'}));
      });
    };

    window.mglRoute=function(lng,lat){
      if(!HAS_USER)return;
      try{map.removeLayer('route-bg');map.removeLayer('route');map.removeSource('route-src')}catch(e){}
      drawRouteOSRM(lng,lat).then(function(coords){
        map.addSource('route-src',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}});
        map.addLayer({id:'route-bg',type:'line',source:'route-src',paint:{'line-color':'#000','line-width':8,'line-opacity':0.3},layout:{'line-cap':'round','line-join':'round'}});
        map.addLayer({id:'route',type:'line',source:'route-src',paint:{'line-color':'#E8A020','line-width':5,'line-opacity':0.9},layout:{'line-cap':'round','line-join':'round'}});
        var rb=new maplibregl.LngLatBounds(coords[0],coords[0]);
        coords.forEach(function(c){rb.extend(c)});
        map.fitBounds(rb,{padding:60,maxZoom:15});
      });
    };
  } catch(e) {
    console.error(e);
    initLeaflet();
  }
}

function initLeaflet(){
  try {
    var container = document.getElementById('map');
    if (container) {
      container.innerHTML = '';
      delete container._leaflet_id;
    }

    loadCSS('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css');
    loadScript('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', function(){
      document.getElementById('status').style.display='none';
      var map=window.map=L.map('map',{center:[ULAT,ULNG],zoom:12,zoomControl:false,attributionControl:false});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

      map.whenReady(function() {
        notifyReady();
      });

      var icon=L.divIcon({html:'<div class="marker">'+scissorsSvg+'</div>',className:'',iconSize:[32,32],iconAnchor:[16,16],popupAnchor:[0,-18]});

      window.updateUserLocation = function(lng, lat) {
        ULNG = lng;
        ULAT = lat;
        HAS_USER = true;
        if (userMarker) {
          userMarker.setLatLng([lat, lng]);
        } else {
          userMarker=L.marker([lat,lng],{icon:L.divIcon({html:'<div class="user-dot"></div>',className:'',iconSize:[14,14],iconAnchor:[7,7]}),zIndexOffset:1000}).addTo(map);
        }
      };

      window.flyToUser = function(lng, lat) {
        map.setView([lat, lng], 13, {animate: true});
      };

      window.updateSalons = function(salonsData) {
        map.closePopup(); // close before rebuild
        DATA = salonsData || [];
        salonMarkers.forEach(function(m){map.removeLayer(m)});
        salonMarkers = [];

        DATA.forEach(function(s){
          var m = L.marker([s.lat,s.lng],{icon:icon}).addTo(map);
          m.on('click', function(){
            safePostMessage(JSON.stringify({type:'MARKER_CLICK', salonId:s.id}));
          });
          salonMarkers.push(m);
        });

        if(DATA.length>0){
          var pts=DATA.map(function(s){return[s.lat,s.lng]});
          map.fitBounds(pts,{padding:[40,40],maxZoom:14});
        }
      };

      map.on('popupclose', function() {
        safePostMessage(JSON.stringify({type:'POPUP_CLOSE'}));
      });

      window.selectSalon = function(salonId) {
        map.closePopup();
        if(!salonId) return;
        var s = DATA.find(function(item){return item.id === salonId;});
        if(!s) return;
        map.setView([s.lat, s.lng], 14, {animate: true});

        var dirBtn=HAS_USER?'<button class="p-btn p-dir" onclick="lfRoute('+s.lng+','+s.lat+')">Itin\u00e9raire</button>':'';
        var popupHtml='<div class="p-name">'+s.name+'</div><div class="p-info">\u2B50 '+s.rating+' \u00B7 '+s.wilaya+'</div><div class="p-actions"><button class="p-btn p-view" onclick="safePostMessage(JSON.stringify({type:\\\'SALON_PRESS\\\', salonId:\\\''+s.id+'\\\'}))">Voir salon</button>'+dirBtn+'</div>';
        
        L.popup({maxWidth:240, offset:[0,-18]})
          .setLatLng([s.lat, s.lng])
          .setContent(popupHtml)
          .openOn(map);
      };

      window.lfRoute=function(lng,lat){
        if(routeLayer){map.removeLayer(routeLayer)}
        drawRouteOSRM(lng,lat).then(function(coords){
          routeLayer=L.polyline(coords.map(function(c){return[c[1],c[0]]}),{color:'#E8A020',weight:5,opacity:0.85}).addTo(map);
          map.fitBounds(routeLayer.getBounds(),{padding:[50,50]});
        });
      };

      setTimeout(function(){map.invalidateSize()},300);
    }, function(){
      document.getElementById('status').innerHTML='Erreur de chargement Leaflet. Veuillez vérifier votre connexion internet.';
      notifyReady();
    });
  } catch(e) {
    document.getElementById('status').innerHTML='Erreur initLeaflet: ' + e.message;
    notifyReady();
  }
}
</script>
</body>
</html>`;
  }, []);

  // ── Update user dot position via JS injection ──
  const prevLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!mapReady || !userLocation || !webViewRef.current) return;

    const prev = prevLocationRef.current;
    if (
      prev &&
      Math.abs(prev.latitude - userLocation.latitude) < 0.00001 &&
      Math.abs(prev.longitude - userLocation.longitude) < 0.00001
    ) {
      return;
    }
    prevLocationRef.current = userLocation;

    webViewRef.current.injectJavaScript(
      `if(window.updateUserLocation){window.updateUserLocation(${userLocation.longitude}, ${userLocation.latitude});}true;`
    );

    if (!hasCenteredOnUser.current) {
      hasCenteredOnUser.current = true;
      webViewRef.current.injectJavaScript(
        `if(window.flyToUser){window.flyToUser(${userLocation.longitude}, ${userLocation.latitude});}true;`
      );
    }
  }, [userLocation, mapReady]);

  const handleMessage = useCallback(
    (event: any) => {
      const rawData = event.nativeEvent.data;
      if (rawData === 'MAP_READY') {
        setMapReady(true);
        return;
      }
      try {
        const parsed = JSON.parse(rawData);
        if (parsed.type === 'MARKER_CLICK') {
          if (onMarkerClick) {
            onMarkerClick(parsed.salonId);
          }
        } else if (parsed.type === 'SALON_PRESS') {
          if (onSalonPress) {
            onSalonPress(parsed.salonId);
          }
        } else if (parsed.type === 'POPUP_CLOSE') {
          if (onPopupClose) {
            onPopupClose();
          }
        }
      } catch (e) {
        // Fallback for raw string message
        if (onSalonPress) {
          onSalonPress(rawData);
        }
      }
    },
    [onSalonPress, onMarkerClick],
  );

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHtml }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        cacheEnabled={true}
        cacheMode="LOAD_CACHE_ELSE_NETWORK"
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          console.warn('WebView load error:', syntheticEvent.nativeEvent);
          setMapReady(true);
        }}
        onHttpError={(syntheticEvent) => {
          console.warn('WebView HTTP error:', syntheticEvent.nativeEvent);
          setMapReady(true);
        }}
      />

      {!mapReady && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.amber} size="small" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={zoomIn} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={zoomOut} activeOpacity={0.7}>
          <Ionicons name="remove" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, styles.recenterButton]} onPress={resetView} activeOpacity={0.7}>
          <Ionicons name="compass-outline" size={18} color={colors.amber} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26,26,46,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  loadingText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    color: '#666',
  },
  controls: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    gap: 4,
  },
  controlButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(26,26,46,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterButton: {
    marginTop: 4,
    borderColor: 'rgba(232,160,32,0.3)',
  },
});
