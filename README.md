# Unseen (personal)

ซ่อน "Seen", "Typing..." และการดู Story บน Facebook / Messenger (เขียนเอง ไม่ใช่โค้ดของ ESUIT)

## ติดตั้ง
1. ปิด ESUIT Un Seen (ใช้พร้อมกันไม่ได้ จะแย่งกันแก้โมดูลเดียวกัน)
2. `chrome://extensions` → เปิด Developer mode → **Load unpacked** → เลือกโฟลเดอร์นี้ (หลังแก้โค้ดให้กด reload ที่การ์ด)
3. รีโหลดหน้า Facebook / Messenger
4. ปักไอคอนรูปตาถูกขีดฆ่าไว้ที่แถบเครื่องมือ กดเพื่อเปิด/ปิดแต่ละฟีเจอร์ได้ (มีผลทันที ยกเว้น Typing ในแชท E2EE ที่ปิดไว้ตลอด)

## ตรวจว่าทำงาน
เปิด DevTools → Console พิมพ์ `__unseenLog` ควรเห็น `patched …` / `source patched …`
ถ้าเห็น `no match <ชื่อ>` แปลว่า Facebook เปลี่ยนชื่อโมดูลนั้น ต้องแก้ตารางใน `hook.js`

## ไฟล์
- `hook.js` แก้โมดูลของ Facebook (รันในโลก JS ของหน้าเพจ)
- `bridge.js` ส่งค่าสวิตช์จาก `chrome.storage` ไปให้ `hook.js`
- `popup.html` / `popup.js` หน้าตั้งค่า 3 สวิตช์
- `check.js` ทดสอบ logic โดยไม่ต้องใช้เบราว์เซอร์: `node check.js`

## ข้อจำกัด
- ชื่อโมดูลเป็นของภายใน Facebook พังได้ทุกเมื่อที่ Facebook อัปเดต
- ขอสิทธิ์ `storage` อย่างเดียว ไม่ส่งข้อมูลออกนอกเครื่อง

## License

MIT
