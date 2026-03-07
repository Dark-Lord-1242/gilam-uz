# 🔥 Firebase Realtime Database Sozlash

## Nima o'zgardi?
Eski versiyada zakazlar faqat **shu qurilmada** saqlanardi (IndexedDB).  
Yangi versiyada zakazlar **Firebase bulutida** saqlanadi — istalgan telefon yoki kompyuterdan ko'rish mumkin!

---

## Sozlash qadamlari (5 daqiqa)

### 1. Firebase loyiha yarating
1. **https://console.firebase.google.com** ga kiring
2. **"Add project"** tugmasini bosing
3. Loyiha nomi: `gilam-zakaz` (yoki xohlagan nom)
4. Google Analytics: o'chirib qo'ying (kerak emas)
5. **"Create project"** bosing

### 2. Realtime Database yoqing
1. Chap menuda **"Build"** → **"Realtime Database"** bosing
2. **"Create Database"** bosing
3. Location: **"us-central1"** (yoki yaqin joyi)
4. Security rules: **"Start in test mode"** tanlang ✅
5. **"Enable"** bosing

### 3. Database URL ni oling
Yaratilgandan keyin sahifa tepasida URL ko'rinadi:
```
https://gilam-zakaz-XXXXX-default-rtdb.firebaseio.com/
```
Bu URLni nusxa oling!

### 4. script.js ga joylashtiring
`script.js` faylning boshida (2-qator):
```javascript
var FIREBASE_URL = 'https://gilam-zakaz-XXXXX-default-rtdb.firebaseio.com';
```
O'z URL ingizni o'sha yerga yozing.

### 5. Xavfsizlik qoidalarini sozlang (muhim!)
Firebase Console → Realtime Database → **Rules** tabiga o'ting:

```json
{
  "rules": {
    "orders": {
      ".read": true,
      ".write": true
    }
  }
}
```
**"Publish"** bosing.

---

## Tayyor! 🎉

Endi:
- **Bir telefonda zakaz qo'shilsa** → 8 soniyada boshqa telefonda ham ko'rinadi
- **Internet bo'lmasa** → xato xabar ko'rsatadi
- **Bepul tarif**: oyiga 1GB ma'lumot, 10GB yuklab olish — bu dastur uchun yetarli

---

## Muammolar

**"Firebase ulanmagan" xato chiqsa:**
- Internet ulanishini tekshiring
- FIREBASE_URL to'g'ri kiritilganligini tekshiring
- Firebase Console da database yoqilganligini tekshiring

**Zakazlar ko'rinmasa:**
- Firebase Console → Realtime Database → Data bo'limini tekshiring
- Rules "test mode" da ekanligini tekshiring
