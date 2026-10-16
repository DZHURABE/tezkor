# Тезкор — serverga o‘rnatish (VPS)

Kerak: Ubuntu 22.04 yoki 24.04 o‘rnatilgan VPS, `root` paroli yoki SSH kaliti, 15–20 daqiqa.
Server kamida 1 GB RAM bo‘lsin.

## 1. Faylni serverga yuklash

Kompyuteringizda `tezkor.zip` turgan papkada terminal oching (Windows: PowerShell):

```
scp tezkor.zip root@SERVER_IP:/root/
```

`SERVER_IP` o‘rniga serveringiz IP manzilini yozing. Windows’da WinSCP dasturi bilan ham tashlasa bo‘ladi.

## 2. Serverga kirib o‘rnatish

```
ssh root@SERVER_IP
apt-get install -y unzip
unzip tezkor.zip
bash tezkor/deploy/install.sh
```

Skript uchta savol beradi:

1. **Domen.** Domeningiz bo‘lsa (masalan `tezkor.tj`), avval uning DNS’ida `A` yozuvini server IP’siga yo‘naltiring, keyin shu yerga yozing. Domen bo‘lmasa, Enter bosing: `1-2-3-4.sslip.io` ko‘rinishidagi bepul manzil HTTPS bilan beriladi.
2. **Admin telefoni:** 9 raqam, masalan `931112233`.
3. **Admin paroli:** kamida 8 belgi. Uni yozib qo‘ying, boshqa hech qayerda saqlanmaydi.

Oxirida `Tayyor! Brauzerda oching: https://...` chiqadi. O‘sha manzil — dasturingiz.

## 3. Birinchi kun: ishga tushirish tartibi

1. Admin bo‘lib kiring → **Ошхонаҳо → Ошхонаи нав**. Restoran nomi va egasining telefonini yozing.
   Ekranda bir martalik parol chiqadi: uni restoran egasiga bering.
2. **Курйерҳо → Курйери нав**: har bir kuryer uchun xuddi shunday.
3. Restoran egasi o‘z telefonidan kiradi → **Танзимот**: ish soati, xaritada restoran joyi, parolni almashtirish.
   Keyin **Меню**ga taomlarni qo‘shadi va bosh sahifada «Қабули фармоиш»ni yoqadi.
4. Mijozlar saytga kirib o‘zlari ro‘yxatdan o‘tadi va buyurtma beradi.
5. Saytni telefon ekraniga qo‘yish: brauzer menyusi → «Bosh ekranga qo‘shish».

## Muhim

- **To‘lov:** hozircha faqat naqd. Karta orqali to‘lov bank bilan shartnoma tuzilgach ulanadi.
- **Ma’lumotlar:** `/var/lib/tezkor/db.json` faylida, har soatda `backups` papkasiga nusxa olinadi (7 kunlik).
  Haftada bir marta bu papkani kompyuteringizga ko‘chirib oling:
  `scp -r root@SERVER_IP:/var/lib/tezkor/backups ./`
- **Yangilash:** yangi `tezkor.zip`ni yuklab, `unzip -o tezkor.zip && bash tezkor/deploy/install.sh`. Ma’lumot va sozlamalar saqlanib qoladi.
- **Holatni ko‘rish:** `systemctl status tezkor`, loglar: `journalctl -u tezkor -f`.
- **Xarita:** OpenStreetMap’dan keladi. Buyurtmalar ko‘payganda MapTiler kabi pullik xarita xizmatiga o‘tish kerak bo‘ladi (`/etc/tezkor.env` ichida `MAP_TILES`).
- «Ман дар куҷоям» (GPS) tugmasi faqat HTTPS manzilda ishlaydi. O‘rnatish skripti HTTPS’ni o‘zi sozlaydi.
