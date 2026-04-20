# 🧅 Cebula – dokumentacja języka

Cebula to polski język programowania kompilowany do Reacta, działający w całości w przeglądarce.

---

## Struktura programu

Program składa się z jednego lub więcej **modułów**. Moduł `główny` jest punktem wejścia.

```
moduł NazwaModułu {
    warstwa danych  { ... }
    warstwa widoku  { ... }
    warstwa logiki  { ... }
}
```

Wszystkie trzy warstwy muszą być obecne (mogą być puste).

---

## Warstwa danych

Deklaruje stan komponentu.

### `zmienna`
Zmienna reaktywna z wartością początkową.
```
zmienna licznik to 0
zmienna tekst   to "witaj"
zmienna flaga   to prawda
zmienna obiekt  to nic
```

### `parametr`
Zmienna inicjalizowana z zewnątrz (przez `użyj Moduł z { klucz: wartość }`).
```
parametr tytuł
```
Wartość dostępna jako `startWartość` wewnątrz modułu. Parametr jest wymagany – jeśli nie zostanie przekazany przy wywołaniu `użyj`, kompilator zgłosi błąd.

### `akcja` (jako parametr modułu)
Deklaruje, że moduł oczekuje przekazania funkcji z zewnątrz. Różni się od definicji akcji w warstwie logiki.
```
warstwa danych {
    parametr tekst
    akcja gdyKliknięto     // oczekiwana funkcja
}
```
Przy osadzaniu modułu wartość musi być funkcją – typowo wynikiem wyrażenia `wykonaj`:
```
użyj Kafelek z {
    tekst: "Kliknij mnie",
    gdyKliknięto: wykonaj obsłuż z { id: 42 }
}
```
Kompilator sprawdza, czy wszystkie wymagane parametry i akcje zostały przekazane. Przekazanie wartości niebędącej funkcją do parametru `akcja` powoduje błąd w czasie działania.

### `stany`
Definiuje typ wyliczeniowy (enum). Wartości są dostępne jako `Nazwa.Wartość`.
```
stany Kolor: [Czerwony, Zielony, Niebieski]
zmienna wybrany to Kolor.Czerwony
```

---

## Warstwa widoku

Definiuje szablony (funkcje renderujące). Każdy szablon zwraca wyrażenie widoku.

### `szablon główny`
Główny widok modułu – renderowany automatycznie.
```
szablon główny to akapit("Witaj!")
```

### `szablon` (nazwany)
Pomocniczy szablon, wywoływany przez `widok(nazwa)`.
```
szablon stopka to akapit("© 2025")
```

---

## Warstwa logiki

Zawiera instrukcje sterujące i definicje akcji.

### `akcja`
Definiuje akcję wywoływaną przez przyciski lub `wywołaj`.
```
akcja zwiększ {
    ustaw licznik na licznik + 1
}
```

Akcja może przyjmować parametry zadeklarowane słowem `parametr` na początku bloku:
```
akcja usuń {
    parametr indeks
    filtruj zadania dla każdego zad z indeksem ind: ind to nie indeks
}
```

Akcję z parametrami wywołuje się przez `wykonaj`:
```
wykonaj usuń z { indeks: 3 }
```

Kompilator sprawdza przy kompilacji, czy wszystkie zadeklarowane parametry są przekazane w wywołaniu `wykonaj`. Brakujący parametr powoduje błąd kompilacji.

### `ustaw ... na`
Aktualizuje wartość zmiennej.
```
ustaw licznik na licznik + 1
ustaw tekst    na "nowy"
ustaw obiekt.pole na wartość
```

### `filtruj zmienna dla każdego iter [z indeksem ind]: warunek`
Cukier składniowy zastępujący `ustaw ... na dla każdego ... filtruj: ...`. Aktualizuje tablicę, zostawiając tylko elementy spełniające warunek.
```
filtruj zadania dla każdego zad: zad.zrobione to nie fałsz
filtruj zadania dla każdego zad z indeksem ind: ind to nie usuniętyIndeks
```

### `przekształć zmienna dla każdego iter [z indeksem ind]: wyrażenie`
Cukier składniowy zastępujący `ustaw ... na dla każdego ... : ...`. Aktualizuje tablicę, mapując każdy element na nową wartość.
```
przekształć zadania dla każdego zad: { tekst: zad.tekst, zrobione: fałsz }
przekształć zadania dla każdego zad z indeksem ind: wybierz(
    ind to celIndeks,
    { tekst: zad.tekst, zrobione: wybierz(zad.zrobione, fałsz, prawda) },
    zad
)
```

### `wywołaj`
Wywołuje wcześniej zdefiniowaną akcję bez parametrów.
```
wywołaj zwiększ
```

### `jeśli` / `inaczej`
Warunkowe wykonanie.
```
jeśli licznik > 10 {
    ustaw tekst na "duże"
} inaczej {
    ustaw tekst na "małe"
}
```

### `wypisz`
Wypisuje wartość do konsoli przeglądarki (F12).
```
wypisz("Wartość: " + licznik)
```

---

## Timery

Instrukcje w `warstwa logiki` zapisane **poza** blokiem `akcja` uruchamiają się automatycznie raz przy starcie modułu. To naturalny sposób na inicjalizację — np. wystartowanie timera:

```
warstwa logiki {
    ustaw timer na cyklicznie(1000, tik)   // uruchamia się przy starcie

    akcja zatrzymaj {
        anuluj(timer)
    }
}
```

### `cyklicznie(ms, akcja)`
Uruchamia akcję co `ms` milisekund. Zwraca identyfikator timera (można go przypisać do zmiennej i anulować).
```
// Jako wyrażenie – zapisz ID timera:
ustaw timer na cyklicznie(1000, tik)

// Jako samodzielna instrukcja (ID jest porzucany):
cyklicznie(500, odśwież)
```

### `opóźnij(ms, akcja)`
Uruchamia akcję jednorazowo po `ms` milisekundach. Tak jak `cyklicznie`, może być wyrażeniem.
```
ustaw odliczanie na opóźnij(3000, schowaj)
```

### `anuluj(timer)`
Zatrzymuje timer o podanym identyfikatorze (wywołuje `clearInterval`).
```
anuluj(timer)
ustaw timer  na nic
ustaw działa na fałsz
```

---

## Wyrażenia widoku

### Układ

| Składnia | Opis |
|---|---|
| `wiersz([...])` | Dzieci w rzędzie (flex row) |
| `wiersz({ style }, [...])` | Rząd z dodatkowymi stylami |
| `kolumna([...])` | Dzieci w kolumnie (flex column) |
| `kolumna({ style }, [...])` | Kolumna z dodatkowymi stylami |
| `rozciągnij({ style }, wyrażenie)` | Kontener z dowolnymi stylami |
| `styl({ style }, wyrażenie)` | Dowolny element z dodatkowymi stylami |

### Treść

| Składnia | Opis |
|---|---|
| `nagłówek(poziom, tekst)` | `<h1>` – `<h6>` |
| `akapit(tekst)` | Akapit tekstu (`<p>`) |
| `pogrubienie(tekst)` | Pogrubiony tekst (`<b>`) |
| `kolor("kolor_css", tekst)` | Tekst w kolorze |

### Formularze

| Składnia | Opis |
|---|---|
| `poleTekstowe("etykieta", zmienna)` | Pole tekstowe |
| `jednokrotnyWybór("etykieta", { "etyk": Wartość }, zmienna)` | Przyciski radio |
| `polePtaszek("etykieta", zmienna)` | Pole wyboru (checkbox) |
| `przycisk("tekst", akcja)` | Przycisk |
| `przycisk("tekst", akcja, { style })` | Przycisk z własnymi stylami |

Jako akcję przycisku można przekazać: nazwę akcji bez parametrów, wyrażenie `wykonaj akcja z { ... }`, lub `brak` (przycisk nieaktywny).

### Logika w widoku

| Składnia | Opis |
|---|---|
| `wybierz(warunek, jeśliPrawda, jeśliFałsz)` | Operator trójkowy |
| `dopasuj zmienna { gdy Wart: wyraż, ... inaczej: wyraż }` | Dopasowanie wzorca (switch) |
| `widok(nazwaSzablonu)` | Wstawia nazwany szablon |
| `użyj NazwaModułu z { klucz: wartość }` | Osadza inny moduł z parametrami |
| `wykonaj akcja z { klucz: wartość }` | Tworzy wywołanie akcji z parametrami (do przekazania jako obsługę przycisku lub parametr akcji modułu) |

---

## Wartości i wyrażenia

| Wartość | Opis |
|---|---|
| `"tekst"` | Łańcuch znaków |
| `42`, `3.14` | Liczba |
| `prawda` / `fałsz` | Wartość logiczna |
| `nic` | Brak wartości (`null`) |
| `brak` | Brak akcji (w przyciskach) |
| `Enum.Wartość` | Wartość wyliczeniowa |
| `obiekt.pole` | Dostęp do pola obiektu |

Operatory arytmetyczne: `+`, `-`, `*`, `/`

Operator `+` działa też jako konkatenacja tekstu i łączenie tablic:
```
"Liczba: " + licznik
lista1 + [nowyElement]
```

Operatory porównania:

| Operator | JavaScript | Opis |
|---|---|---|
| `a == b` | `a == b` | Luźna równość |
| `a != b` | `a != b` | Luźna nierówność |
| `a to b` | `a === b` | Ścisła równość |
| `a to nie b` | `a !== b` | Ścisła nierówność |
| `a > b` | `a > b` | Większy |
| `a < b` | `a < b` | Mniejszy |

---

## Pętle i listy

### `dla każdego iter z lista [z indeksem ind]: wyrażenie`
Iteruje po tablicy i tworzy element widoku dla każdego elementu. Opcjonalna klauzula `z indeksem` udostępnia indeks bieżącego elementu. Zwraca tablicę elementów — można jej użyć bezpośrednio jako dziecka `wiersz`/`kolumna`.

```
// Bez indeksu:
dla każdego owoc z owoce: akapit(owoc)

// Z indeksem:
dla każdego zad z zadania z indeksem ind: użyj WierszZadania z {
    tekst: zad.tekst,
    gdyUsuń: wykonaj usuń z { indeks: ind }
}
```

### `dla każdego iter z lista [z indeksem ind] filtruj: warunek`
Filtruje tablicę jako wyrażenie — przydatne w widoku lub jako argument `długość(...)`.
```
długość(dla każdego zad z zadania filtruj: zad.zrobione)

dla każdego zad z zadania z indeksem ind filtruj: ind to nie 0
```

### `element(lista, indeks)`
Zwraca element tablicy o podanym indeksie. Obsługuje dostęp do pól przez `.`:
```
element(zadania, 0).tekst
element(zadania, i).zrobione
```

### `długość(lista)`
Zwraca liczbę elementów tablicy.
```
długość(zadania)
```

### `zakres(n)` / `zakres(od, do)`
Zwraca tablicę liczb całkowitych.

| Wywołanie | Wynik |
|---|---|
| `zakres(4)` | `[0, 1, 2, 3]` |
| `zakres(1, 5)` | `[1, 2, 3, 4]` |

```
dla każdego i z zakres(1, 5): nagłówek(i, "Sekcja " + i)
```

---

## Właściwości CSS (obiekty stylów)

Klucze obiektów stylów są tłumaczone na CSS **w czasie kompilacji**. Wartości muszą być prawidłowymi wartościami CSS (jako łańcuchy znaków) lub wyrażeniami Cebuli.

### Tło i odstępy

| Cebula | CSS |
|---|---|
| `tło` | `background` |
| `wypełnienie` | `padding` |
| `wypełnienieGóra` / `Dół` / `Lewo` / `Prawo` | `paddingTop` itd. |
| `margines` | `margin` |
| `marginesGóra` / `Dół` / `Lewo` / `Prawo` | `marginTop` itd. |
| `odstęp` | `gap` |

### Wymiary i Flexbox

| Cebula | CSS |
|---|---|
| `szerokość` / `minSzerokość` / `maxSzerokość` | `width` / `minWidth` / `maxWidth` |
| `wysokość` / `minWysokość` / `maxWysokość` | `height` / `minHeight` / `maxHeight` |
| `proporcja` | `flex` |
| `wyrównanieElementów` | `alignItems` |
| `wyrównanieZawartości` | `justifyContent` |
| `zawijanie` | `flexWrap` |
| `wyświetlanie` | `display` |

### Pozycjonowanie

| Cebula | CSS |
|---|---|
| `pozycja` | `position` |
| `góra` / `dół` / `lewo` / `prawo` | `top` / `bottom` / `left` / `right` |
| `przepełnienie` | `overflow` |
| `zIndex` | `zIndex` |

### Typografia

| Cebula | CSS |
|---|---|
| `kolor` | `color` |
| `czcionka` | `fontSize` |
| `rodzinaCzcionki` | `fontFamily` |
| `grubośćCzcionki` | `fontWeight` |
| `stylCzcionki` | `fontStyle` |
| `wyrównanieTekstu` | `textAlign` |
| `dekoracjaTekstu` | `textDecoration` |
| `wysokośćLinii` | `lineHeight` |
| `odstępLiter` | `letterSpacing` |

### Obramowanie i efekty

| Cebula | CSS |
|---|---|
| `obramowanie` | `border` |
| `obramowanieGóra` / `Dół` / `Lewo` / `Prawo` | `borderTop` itd. |
| `zaokrąglenie` | `borderRadius` |
| `cień` | `boxShadow` |
| `przezroczystość` | `opacity` |
| `kursor` | `cursor` |
| `transformacja` | `transform` |
| `przejście` | `transition` |

### Przykład
```
kolumna({
    tło: "#f5f5f5",
    wypełnienie: "20px",
    odstęp: "10px",
    obramowanie: "1px solid #ddd",
    zaokrąglenie: "8px",
}, [...])
```

---

## Komentarze

```
// To jest komentarz jednoliniowy
```

---

## Uwagi techniczne

- Cebula kompiluje się do kodu JavaScript z React Hooks (`useState`, `useEffect`).
- Każdy moduł staje się funkcją `Module_NazwaModułu`.
- Zmienne reaktywne to `useState`; przypisania to wywołania setterów.
- Gdy zmienna pojawia się w swoim własnym przypisaniu (`ustaw x na x + 1`), kompilator automatycznie generuje formę funkcyjną `setX(prev => prev + 1)` – dzięki temu timery z `setInterval` działają poprawnie bez przestarzałych domknięć. To samo dotyczy instrukcji `filtruj` i `przekształć`.
- Kompilacja jest dwuprzebiegowa: najpierw `scanDecls` zbiera wszystkie deklaracje parametrów i akcji, potem `toJS` waliduje ich użycie przy `użyj` i `wykonaj`.
- Wszystkie klucze identyfikatorowe w literałach obiektów stylów są tłumaczone przez mapę CSS w czasie kompilacji.
