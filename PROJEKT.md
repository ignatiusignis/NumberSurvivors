# Number Survivors — dokument projektu

**Wersja:** 0.3  
**Status:** zatwierdzone założenia projektu; szczegóły wskazane jako otwarte pozostają do opracowania  
**Data aktualizacji:** 18 listopada 2026

## 1. Koncepcja i fabuła

Number Survivors to edukacyjna, dynamiczna gra survivalowa 2D inspirowana *Vampire Survivors*. Gracz porusza się po świecie fantasy zamieszkanym przez dzikie liczby złożone. Ich przywódca **Multiplos** ukradł teczkę zawierającą wszystkie czerwone paski na świadectwa. Zadaniem gracza jest odnalezienie teczki przed upływem **30 minut**.

**Zmiana względem v0.1:** zamiast neonowej cyfrowej areny przyjmujemy kolorową krainę fantasy, której otoczenie stopniowo staje się mroczniejsze.

## 2. Menu i rozpoczęcie gry

Menu główne zawiera tylko:
- **Nowa gra**
- **Jak grać / Zasady**

Po wybraniu „Nowa gra” pojawia się ekran wprowadzający z przyciskiem **START**.

Proponowany tekst wprowadzenia:

> Witaj, młody odkrywco!
>
> Dotarłeś do świata zamieszkanego przez dzikie liczby złożone.
>
> Ich przywódca, Multiplos, ukradł teczkę zawierającą wszystkie czerwone paski na świadectwa!
>
> Musisz odnaleźć teczkę i odzyskać jej zawartość. Ale strzeż się! Masz tylko 30 minut, zanim Multiplos Cię odnajdzie i przeszkodzi w poszukiwaniach.
>
> Powodzenia, odkrywco!

## 3. Świat, nawigacja i przestrzeń do walki

Gra rozgrywa się w **jednym ciągłym świecie** z płynnymi przejściami pomiędzy krainami:
1. Trawiasta, przyjemna zielona okolica.
2. Mokradła.
3. Zarośla i krzaki.
4. Las.
5. Przedpole zamku.
6. Zamek.
7. Lochy.

Gracz sam przemieszcza się w kierunku zamku. **Kompas wskazuje wyłącznie kierunek zamku**. Po wejściu do zamku kompas znika; wejście do lochów trzeba odnaleźć samodzielnie.

**Zasada dla całego świata, także zamku i lochów:** główne przejścia i przestrzenie do walki mają być szerokie — **co najmniej połowa szerokości widocznego ekranu**. Układ nie może nadmiernie utrudniać manewrowania ani być przesadnie skomplikowany. Szczegóły skali i kolizji sprawdzimy w prototypie na różnych rozdzielczościach.

Mapa ma być wydajna: aktywne renderowanie i aktualizowanie przede wszystkim otoczenia gracza, bez ciągłego animowania odległych obszarów.

## 4. Matematyka i walka

- Przeciwnicy reprezentują liczby złożone (np. 30, 64, 210).
- Dostępne dzielniki pierwsze: **2, 3, 5, 7, 11, 13, 17, 19**, dostępne graczowi od początku. Kolejne krainy stopniowo rozszerzają pulę czynników pierwszych występujących u przeciwników; wcześniej wprowadzone czynniki pozostają w puli.
- Wybrane dzielniki atakują **automatycznie**.
- Trafienie dzieli liczbę przeciwnika przez dzielnik, jeśli dzielenie jest możliwe. Niepoprawny dzielnik nie powoduje podziału.
- Gdy liczba osiągnie **1**, przeciwnik zostaje pokonany.
- Liczba przeciwnika pełni funkcję jego punktów życia; nie potrzebuje osobnego paska HP.
- Przykład: **30 → 15 (÷2) → 5 (÷3) → 1 (÷5)**.
- Każdy aktywny dzielnik wyszukuje najbliższego odpowiedniego przeciwnika.

### Sloty i sterowanie

- Początek: **1 slot**.
- **Poziom 20:** automatycznie odblokowany drugi slot.
- **Poziom 40:** automatycznie odblokowany trzeci slot.
- Maksymalnie 3 aktywne dzielniki.
- Klawisze **1–8** wybierają kolejno dzielniki **2, 3, 5, 7, 11, 13, 17, 19**; **9 i 0** są zarezerwowane.
- Wybór nowego dzielnika przy pełnych slotach zastępuje najdawniej wybrany (**FIFO**). Ponowny wybór już aktywnego nie tworzy duplikatu.
- Naciśnięcie klawisza wybiera automatyczną broń, a nie pojedynczy strzał.
- Sterowanie dotykowe planowane na później.

## 5. Pojawianie się przeciwników i trudność

### Pierwsza minuta
Na rozgrzewkę pojawiają się **po 2 przeciwników co 20 sekund** (początek gry, 0:20 i 0:40).

### Od pierwszej minuty
- Pokonanie przeciwnika pozwala systemowi uzupełnić pulę aktywnych wrogów.
- Przeciwnicy pojawiają się **tuż poza widocznym ekranem**, tak aby naturalnie wchodzili w pole widzenia.
- Wrogowie pozostawieni bardzo daleko za graczem mogą zostać przeniesieni poza ekran przed kierunek jego ruchu, aby nie obciążać gry i nie znikać bezpowrotnie.
- Stosujemy **budżet trudności**: duża liczba prostych przeciwników lub mniejsza liczba bardziej wymagających, z możliwością fal prostszych wrogów.
- Trudność matematyczna zależy m.in. od liczby czynników pierwszych z powtórzeniami (liczba potrzebnych trafień) oraz liczby różnych czynników.
- Wszystkie dzielniki 2–19 są od początku dostępne graczowi, ale generator wrogów rozszerza dozwolone czynniki pierwsze wraz z kolejnymi krainami. Wcześniejsze czynniki pozostają w puli. Proponowany podział: trawa — 2; mokradła — +3; zarośla — +5; las — +7; przedpole zamku — +11; zamek — +13 i +17; lochy — +19. Szczegółowy podział pozostaje do przetestowania.
- Wrogowie muszą być możliwi do pokonania dostępnymi dzielnikami.

Szczegóły harmonogramu, limitów aktywnych wrogów i fal ustalimy podczas projektowania i testów.

## 6. EXP, poziomy i złote jedynki

- Każdy pokonany przeciwnik pozostawia **jedną złotą jedynkę** o wartości **1 EXP**.
- Żetony **pozostają na ziemi bez ograniczenia czasu**, aż zostaną zebrane.
- Gracz zbiera je w określonym promieniu; **zasięg zbierania** można zwiększać ulepszeniami.
- Złota jedynka ma własną prostą grafikę przypominającą złotą monetę, bez używania emoji jako docelowej grafiki.

Wymagania EXP oznaczają koszt **kolejnego awansu**, nie sumę od początku:

| Awans | EXP |
| --- | ---: |
| 1 → 2 | 2 |
| 2 → 3 | 4 |
| 3 → 4 | 6 |
| 4 → 5 | 10 |
| 5 → 6 | 20 |
| 6 → 7 | 30 |
| 7 → 8 | 40 |
| 8 → 9 | 50 |
| 9 → 10 | 60 |
| 10 → 11 | 70 |
| 11 → 12 | 80 |
| 12 → 13 | 90 |
| 13 → 14 i każdy następny | 100 |

Przy 1 EXP na przeciwnika poziom 20 wymaga łącznie **1162 EXP**, a poziom 40 — **3162 EXP**. Tempo rozwoju i osiągalność slotów w 30-minutowej sesji trzeba zweryfikować podczas testów; na razie **nie zmieniamy** tabeli.

### Magnes EXP
- Magnes pojawia się **losowo na mapie**, nie za określoną liczbę zabitych wrogów.
- Po podniesieniu zbiera **wszystkie niezebrane złote jedynki** z całej mapy.
- EXP przylatuje do postaci efektowną **falą**, a nie natychmiastowym teleportem.
- Ze względów wydajnościowych odległe żetony są zapamiętywane bez ciągłej animacji; przy magnesie można grupować ich wizualizację zamiast animować tysiące osobnych obiektów. Naliczony EXP musi odpowiadać wszystkim zebranym żetonom.

## 7. Rozwój postaci

Gracz zdobywa poziomy i wybiera ulepszenia z losowych propozycji (roboczo: wybór 1 z 3).

Przykładowe kategorie:
- **Postać:** zdrowie, leczenie, regenerująca się tarcza, szybkość poruszania.
- **Ataki:** szybkość, zasięg, liczba jednoczesnych celów.
- **Efekty specjalne:** atak obszarowy blisko postaci, naprowadzany pocisk obszarowy, ognisty ślad utrzymujący się krótko (roboczo 2 sekundy), trwały przez pewien czas obszar działania podobny do koktajlu Mołotowa.

Ulepszenia specjalne mogą być związane z konkretnymi dzielnikami. Szczegóły do ustalenia. Odblokowanie slotów na poziomach 20 i 40 jest automatyczne i niezależne od zwykłych nagród.

## 8. Zamek, lochy i teczka

- W zamku nie ma kompasu. Gracz sam odnajduje wejście do lochów.
- Lochy przypominają **prosty, czytelny labirynt**: niewiele rozgałęzień, bez przesadnie długich i mylących korytarzy.
- Korytarze i przestrzenie do walki pozostają **szerokie — minimum pół ekranu**, tak samo jak w pozostałych krainach i zamku.
- W lochach znajdują się **5 skrzyń** w pięciu ustalonych lokalizacjach.
- Na początku każdej nowej gry **losowana jest dokładnie jedna skrzynia** zawierająca teczkę; wybór nie zmienia się podczas sesji.
- Pozostałe skrzynie nie zawierają teczki.
- **Nie ma kluczy ani dodatkowych zagadek**: wystarczy dotrzeć do skrzyni i ją otworzyć.
- Odnalezienie teczki przed upływem limitu oznacza **zwycięstwo**.

## 9. Multiplos i zakończenie gry

- Jeśli gracz nie znajdzie teczki w ciągu **30 minut**, pojawia się **Multiplos**.
- Boss jest zbudowany m.in. z liczb pierwszych **23, 29 i 31**, których gracz nie może dzielić dostępnymi broniami.
- Multiplos **zawsze zna pozycję gracza** i bezpośrednio go ściga.
- **Przechodzi przez ściany i wszelkie przeszkody**, aby nie blokować się na geometrii mapy.
- Porusza się i atakuje na tyle szybko i mocno, że **nie da się przed nim skutecznie obronić ani uciec**.
- Jego nadejście oznacza nieuchronną porażkę; można poprzedzić je krótkim ostrzeżeniem fabularnym.
- Gracz może również przegrać wcześniej, gdy zwykli przeciwnicy pozbawią go zdrowia.

## 10. Technologia i wydajność

- **HTML, CSS, JavaScript i Phaser**.
- Kod w **modułach**, nie w jednym monolitycznym pliku.
- Gra dostępna **bezpłatnie w przeglądarce**.
- Początkowo sterowanie klawiaturą; docelowo także dotykowe.
- Rozgrywki niezależne, bez trwałych ulepszeń postaci.
- Opcjonalny ranking w przyszłości; globalny ranking wymaga zaplecza serwerowego i rozwiązania kwestii bezpiecznych nazw graczy.
- **Optymalizacja:** aktualizowanie i renderowanie przede wszystkim widocznych fragmentów mapy; odległe obszary i niezebrane żetony nie wymagają ciągłych animacji. Wrogowie są zarządzani tak, by ograniczać koszty symulacji i renderowania.


## 11. Bohater i przyszłe klasy postaci

- Pierwsza grywalna klasa to **łotrzyk/łucznik**, z własną, oryginalną grafiką fantasy pixel art.
- **Spacja** uruchamia krótki unik: szybkie przemieszczenie w kierunku aktualnego ruchu oraz **chwilową nietykalność**.
- Unik nie pozwala przenikać przez stałe przeszkody; jego długość, czas trwania i odnowienie ustalimy w testach (roboczo 0,2 s i 4 s odnowienia).
- W przyszłości możliwe kolejne klasy: **wojownik z tarczą** i **mag z dodatkowym atakiem**, a także osobne **drzewka rozwoju klas**.
- Grafiki mają być oryginalne, bez kopiowania chronionych zasobów innych gier.

## 12. Rodziny przeciwników, liczby i fale

### Wygląd
- Wariant **C**: fantastyczne stworki o prostych, geometrycznych korpusach, z **dużą, kontrastową liczbą na ciele**.
- Cztery podstawowe rodziny, od łatwiejszych do trudniejszych: **szczury, pająki, nietoperze, wilki**.
- W obrębie rodziny można używać wariantów kolorystycznych i kilku bazowych modeli.
- Liczba pozostaje czytelna w ruchu; docelowe grafiki nie są emoji.

### Ograniczenia generatora
- Zwykły przeciwnik ma liczbę **nie większą niż 9999** (maksymalnie cztery cyfry).
- Zwykły przeciwnik wymaga **maksymalnie 8 poprawnych podziałów** do pokonania.
- Generujemy wyłącznie liczby z czynników pierwszych dopuszczonych dla aktualnej krainy.
- Proste liczby wymagające niewielu podziałów (np. 8, 9, 16, 27) mają pojawiać się **tylko na początku gry**, a nie w zamku i lochach.
- Robocze przedziały liczby podziałów: początek 2–4, wczesne krainy 3–5, środkowe 4–6, zamek i lochy 5–8. Ostateczny balans do testów.

### Pule minutowe
- **Pierwsza minuta:** tylko przeciwnicy z liczbą **8**; po **2 sztuki co 20 sekund**.
- **Druga minuta:** dwa rodzaje liczb, np. **8 i 12**.
- **Od trzeciej minuty:** **maksymalnie 3 rodzaje liczb w puli na każdą minutę**. Każdy rodzaj może mieć wielu przedstawicieli.
- Na granicy minuty losowana lub dobierana jest nowa pula; nowe jednostki pochodzą tylko z aktualnej puli. **Niedobitki poprzednich minut mogą pozostać**.
- **Wyjątek optymalizacyjny:** po rozpoczęciu nowej minuty przeciwnik ze starej puli może zostać usunięty bez EXP, gdy znajduje się całkowicie poza ekranem, a dodatkowy dystans od granicy widoku wynosi co najmniej **pół szerokości ekranu**. Nie znika na oczach gracza.
- Przeciwników z bieżącej puli można przenosić poza ekran przed kierunek ruchu gracza, zgodnie z zasadami odciążania symulacji.
- Liczbę jednostek nadal kontroluje **budżet trudności**, a nie tylko liczba modeli czy rodzajów.

## 13. Numeracja wersji

**Dokument projektu** jest obecnie w wersji **0.3**; jest to numer rewizji założeń, nie numer wydania gry.

**Gra** będzie używała numeracji **MAJOR.MINOR.PATCH**, np.:
- **0.1.0** — pierwszy grywalny prototyp;
- **0.1.1**, **0.1.2**, … **0.1.10** — kolejne drobne poprawki;
- **0.2.0** — większa aktualizacja;
- **1.0.0** — pierwsze pełne wydanie.

Numer każdej części może być większy niż 9.

## 14. Otwarte decyzje na kolejne etapy

1. Wygląd i animacje bohatera, przeciwników oraz Multiplosa.
2. Dokładne zachowanie broni, tempo ataków i wybór celów.
3. Harmonogram pojawiania się kolejnych dzielników i trudniejszych przeciwników.
4. Liczba, parametry i dobór ulepszeń.
5. System zdrowia i obrażeń od zwykłych przeciwników.
6. Szczegółowa topologia świata, zamku i prostych lochów.
7. Rozmieszczenie i częstość występowania magnesów.
8. Balans doświadczenia, przeciwników i 30-minutowej sesji.
9. Wygląd interfejsu, sterowanie dotykowe i ewentualny ranking.

---

**Historia decyzji:** v0.1 — fundamenty matematyki i uzbrojenia; v0.2 — fabuła, świat fantasy, 30-minutowy cel, eksploracja, system EXP, magnes, budżet przeciwników, szerokie przejścia w całym świecie, lochy i Multiplos; v0.3 — łotrzyk i unik, przyszłe klasy, modele wrogów, ograniczenia liczb, pule minutowe, optymalizacja niedobitków i numeracja wydań.
