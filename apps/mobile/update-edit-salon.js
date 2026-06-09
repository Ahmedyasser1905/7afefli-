const fs = require('fs');

let content = fs.readFileSync('src/components/barber/EditSalonModal.tsx', 'utf8');

// 1. Add DateTimePicker import
content = content.replace(
  "import { decode } from 'base64-arraybuffer';",
  "import { decode } from 'base64-arraybuffer';\nimport DateTimePicker from '@react-native-community/datetimepicker';"
);

// 2. Remove WILAYAS array
const wilayasRegex = /\/\/ All 58 Algerian wilayas\nconst WILAYAS = \[\n(?:.*?\n)+\];/;
content = content.replace(wilayasRegex, '');

// 3. Remove TIME_CHIPS array
const timeChipsRegex = /\/\/ Time chips from 06:00 to 00:00 in 30-minute increments\nconst TIME_CHIPS: string\[\] = \[\];\nfor \(let h = 6; h <= 23; h\+\+\) \{\n  TIME_CHIPS\.push\(\`\$\{String\(h\)\.padStart\(2, '0'\)\}:00\`\);\n  TIME_CHIPS\.push\(\`\$\{String\(h\)\.padStart\(2, '0'\)\}:30\`\);\n\}\nTIME_CHIPS\.push\('00:00'\);/;
content = content.replace(timeChipsRegex, '');

// 4. Add dynamic states
content = content.replace(
  "const [wilayaSearch, setWilayaSearch] = useState('');",
  "const [wilayaSearch, setWilayaSearch] = useState('');\n  const [wilayas, setWilayas] = useState<string[]>([]);\n  const [showOpenPicker, setShowOpenPicker] = useState(false);\n  const [showClosePicker, setShowClosePicker] = useState(false);\n\n  useEffect(() => {\n    apiClient.get<string[]>('/locations/wilayas').then((data) => setWilayas(data)).catch(() => {});\n  }, []);"
);

// 5. Fix WILAYAS reference
content = content.replace(
  "const filteredWilayas = WILAYAS.filter",
  "const filteredWilayas = wilayas.filter"
);

// 6. Replace open hours UI
const openRegex = /<Text style=\{styles\.label\}>Heure d'ouverture<\/Text>[\s\S]*?<\/ScrollView>/;
const newOpen = `<Text style={styles.label}>Heure d'ouverture</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setShowOpenPicker(true)}>
              <Ionicons name="time-outline" size={18} color={colors.amber} />
              <Text style={styles.input}>{openTime}</Text>
            </TouchableOpacity>
            {showOpenPicker && (
              <DateTimePicker
                value={new Date(\`2000-01-01T\${openTime}:00\`)}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  setShowOpenPicker(false);
                  if (date) {
                    setOpenTime(\`\${String(date.getHours()).padStart(2, '0')}:\${String(date.getMinutes()).padStart(2, '0')}\`);
                  }
                }}
              />
            )}`;
content = content.replace(openRegex, newOpen);

// 7. Replace close hours UI
const closeRegex = /<Text style=\{styles\.label\}>Heure de fermeture<\/Text>[\s\S]*?<\/ScrollView>/;
const newClose = `<Text style={styles.label}>Heure de fermeture</Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setShowClosePicker(true)}>
              <Ionicons name="time-outline" size={18} color={colors.amber} />
              <Text style={styles.input}>{closeTime}</Text>
            </TouchableOpacity>
            {showClosePicker && (
              <DateTimePicker
                value={new Date(\`2000-01-01T\${closeTime}:00\`)}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={(event, date) => {
                  setShowClosePicker(false);
                  if (date) {
                    setCloseTime(\`\${String(date.getHours()).padStart(2, '0')}:\${String(date.getMinutes()).padStart(2, '0')}\`);
                  }
                }}
              />
            )}`;
content = content.replace(closeRegex, newClose);

// 8. Replace dynamic days
const daysRegex = /\{\[\{ day: 0, label: 'Dim' \}, \{ day: 1, label: 'Lun' \}, \{ day: 2, label: 'Mar' \}, \{ day: 3, label: 'Mer' \}, \{ day: 4, label: 'Jeu' \}, \{ day: 5, label: 'Ven' \}, \{ day: 6, label: 'Sam' \}\]\.map/;
const newDays = `{Array.from({ length: 7 }, (_, i) => { const d = new Date(2023, 0, 1 + i); return { day: d.getDay(), label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).charAt(0).toUpperCase() + new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d).slice(1) }; }).sort((a, b) => a.day - b.day).map`;
content = content.replace(daysRegex, newDays);

fs.writeFileSync('src/components/barber/EditSalonModal.tsx', content);
console.log('Successfully updated EditSalonModal.tsx');
