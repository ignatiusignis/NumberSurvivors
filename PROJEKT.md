# Number Survivors — dokument projektu

**Wersja:** 0.1  
**Status:** zatwierdzone założenia wstępne  
**Data:** 18 listopada 2026

## 1. Koncepcja

Number Survivors to dynamiczna gra survivalowa 2D inspirowana *Vampire Survivors*. Gracz porusza się po cyfrowej arenie, walcząc z przeciwnikami reprezentowanymi przez liczby.

Oprawa wizualna: neonowa, komputerowa, inspirowana obwodami elektronicznymi.

## 2. Główna mechanika matematyczna

- Przeciwnicy mają wartości liczbowe, np. 30, 64, 210.
- Gracz wybiera dzielniki pierwsze: **2, 3, 5, 7, 11, 13, 17, 19**.
- Ataki działają automatycznie.
- Trafienie dzieli liczbę przeciwnika przez wybrany dzielnik, jeśli dzielenie jest możliwe.
- Jeśli liczba nie dzieli się przez wybrany dzielnik, atak nie odnosi skutku.
- Przeciwnik ginie, gdy jego liczba osiągnie **1**.
- Wartość liczby zastępuje tradycyjny licznik punktów życia przeciwnika.

**Przykład:** 30 → 15 (÷2) → 5 (÷3) → 1 (÷5) → pokonany.

## 3. System uzbrojenia

- Na początku gracz ma **jeden aktywny slot dzielnika**.
- Na **poziomie 10** automatycznie otrzymuje drugi slot.
- Na **poziomie 20** automatycznie otrzymuje trzeci slot.
- Maksymalnie aktywne są **trzy dzielniki**.
- Wybrany dzielnik atakuje automatycznie; naciśnięcie klawisza oznacza wybór, nie pojedynczy strzał.
- Każdy aktywny dzielnik samodzielnie wyszukuje cel, który można przez niego podzielić, preferując najbliższy.
- Przy pełnych slotach wybór nowego dzielnika zastępuje najdawniej wybrany (FIFO).
- Ponowny wybór już aktywnego dzielnika nie tworzy duplikatu.
- Klawisze **1–8** odpowiadają kolejno dzielnikom **2, 3, 5, 7, 11, 13, 17, 19**. Klawisze **9 i 0** pozostają na przyszłe umiejętności.

## 4. Rozwój postaci

Gracz zdobywa doświadczenie i awansuje na kolejne poziomy. Przy zwykłym awansie wybiera ulepszenie spośród losowych propozycji (roboczo: trzy możliwości).

Przewidywane kategorie ulepszeń:

- **Postać:** zdrowie i leczenie, regenerująca się tarcza, szybkość poruszania się.
- **Atak:** szybkość ataku, zasięg, liczba jednoczesnych celów.
- **Efekty specjalne:** atak obszarowy na bliskim dystansie, naprowadzany pocisk z efektem obszarowym, pozostawiany na krótko ognisty ślad („pożoga”), rzucany obszar utrzymujący efekt przez pewien czas.

Efekty specjalne mogą być powiązane z wybranymi dzielnikami i rozwijane w różne strony; szczegóły wymagają dalszych ustaleń.

Odblokowanie slotów na poziomach 10 i 20 następuje automatycznie, niezależnie od zwykłego wyboru ulepszenia.

## 5. Poziom trudności

- Trudność rośnie wraz z **czasem rozgrywki**, a nie przez przechodzenie do kolejnych stref mapy.
- Z czasem do puli przeciwników dochodzą liczby zawierające kolejne czynniki pierwsze z zakresu 2–19.
- Wcześniejsze czynniki pierwsze pozostają w puli.
- Wytrzymałość przeciwnika zależy od liczby czynników pierwszych z uwzględnieniem powtórzeń; zróżnicowanie taktyczne zależy również od liczby różnych czynników.
- Przeciwników można generować jako iloczyny dopuszczonych na danym etapie liczb pierwszych.
- Planujemy bossów i silniejszego przeciwnika końcowego.
- Nowe rodzaje przeciwników muszą być możliwe do pokonania dostępnymi graczowi dzielnikami.

**Do ustalenia:** długość pojedynczej rozgrywki, tempo wprowadzania kolejnych liczb pierwszych, częstotliwość bossów, szczegółowy balans.

## 6. Założenia techniczne

- **Technologia:** HTML, CSS, JavaScript, silnik Phaser.
- **Architektura:** podział na moduły, aby łatwo rozwijać i testować grę bez przepisywania jednego dużego pliku.
- **Sterowanie:** w pierwszej kolejności klawiatura; później również ekran dotykowy (np. iPad).
- **Dostępność:** bezpłatna gra przeglądarkowa.
- **Rozgrywki:** niezależne sesje, bez trwałego systemu ulepszeń postaci.
- **Ranking wyników:** możliwość dodania w przyszłości; globalny ranking wymaga dodatkowego zaplecza serwerowego i przemyślanego sposobu nadawania nazw graczom.

## 7. Otwarte decyzje

1. Czas trwania pojedynczej rozgrywki.
2. Harmonogram odblokowywania liczb pierwszych i skala trudności.
3. Zachowanie bossów i przeciwnika końcowego.
4. Dokładne zasady zdobywania doświadczenia.
5. Pula i poziomy ulepszeń, w tym zasady efektów specjalnych.
6. System punktacji, ranking i bezpieczne nazwy graczy.
7. Układ interfejsu i szczegóły sterowania dotykowego.

---

Ten dokument opisuje **zatwierdzone fundamenty projektu (v0.1)**. Elementy oznaczone jako robocze lub „do ustalenia” nie są jeszcze ostatecznymi decyzjami.
