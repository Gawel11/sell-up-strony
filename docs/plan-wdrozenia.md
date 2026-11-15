# Sell-UP: stan prac (2026-11-15)

Zrobione 15.11 (dzień 1 i 2 planu):
- Konta klientów: logowanie SMS (SMSAPI, funkcja customer-auth), imię przy pierwszym logowaniu, dane zamówienia z konta.
- Karta lojalnościowa w bazie (settings.loyalty), pieczątki automatycznie po „wydane”, skan „Karta klienta” w kuchni, nagrody, ulubione.
- Bubble tea: zamówienie przy ladzie do panelu, status na żywo, zakładka Zamówienia; „Moje zamówienia” we wszystkich demach.
- Polecenia: link/QR ?od=KOD, nagroda dla obu po pierwszym zakupie, limit 3/mies.
- Panel: Klienci i PUSH (CRM, CSV, ustawienia karty i poleceń, wiadomość PUSH), Promocje (baner z kodem, danie dnia), pakiet Start/PRO/PRO AI (tylko administrator), telefon alarmu.
- Powiadomienia PUSH: sw-push.js, funkcja push-send (status zamówienia, wiadomości od lokalu).
- Kuchnia: zakładki na tablecie, alarm po 3 min (pasek + syrena), SMS po 4 min (funkcja order-alarm + pg_cron).

Struktura:
- db/016–030 – migracje bazy (Supabase), db/functions – funkcje brzegowe.
- lib/sellup-account.js – konto, karta, polecenia, zamówienia, PUSH, promocje.
- kuchnia/ – panel kuchni, panel/ – panel właściciela.
- Wdrożenie: tools/build.js (zaciemnienie) → dist/ → wgranie na serwer.

Dalej: płatności Stripe Connect, panel administratora (nowy lokal), ukrywanie zamawiania w pakiecie Start, domena (sell-up.pl albo selll.app), umowy/RODO, PRO AI.
