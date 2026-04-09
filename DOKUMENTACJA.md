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
Zmienna inicjalizowana z zewnątrz (przez `użyj ModułZ { klucz: wartość }`).
```
parametr startWartość
```
Wartość dostępna jako `startWartość` wewnątrz modułu.

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
Definiuje akcję (funkcję bez parametrów) wywoływaną przez przyciski lub `wywołaj`.
```
akcja zwiększ {
    ustaw licznik na licznik + 1
}
```

### `ustaw ... na`
Aktualizuje wartość zmiennej. Gdy zmienna pojawia się w wyrażeniu po prawej stronie, automatycznie używa funkcji aktualizacji (`prev => ...`) – zapobiega błędom w timerach.
```
ustaw licznik na licznik + 1
ustaw tekst    na "nowy"
ustaw obiekt.pole na wartość
```

### `wywołaj`
Wywołuje wcześniej zdefiniowaną akcję.
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
    ustaw timer na cyklicznie(1000, odśwież)   // uruchamia się przy starcie

    akcja zatrzymaj {
        anuluj(timer)
    }
}
```

### `cyklicznie(ms, akcja)`
Uruchamia akcję co `ms` milisekund. Zwraca identyfikator timera (można go przypisać do zmiennej i anulować).
```
// Jako wyrażenie – zapisz ID timera:
ustaw timer na cyklicznie(1000, dodaj)

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

### Logika w widoku

| Składnia | Opis |
|---|---|
| `wybierz(warunek, jeśliPrawda, jeśliFałsz)` | Operator trójkowy |
| `dopasuj zmienna { gdy Wart: wyraż, ... inaczej: wyraż }` | Dopasowanie wzorca (switch) |
| `widok(nazwaSzablonu)` | Wstawia nazwany szablon |
| `użyj NazwaModułu z { klucz: wartość }` | Osadza inny moduł z parametrami |

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
Operatory porównania: `==` (luźne), `to` (ścisłe `===`), `>`, `<`

Konkatenacja tekstu: `"Liczba: " + licznik`

---

## Pętle i listy

### `dla każdego element z lista: wyrażenie`
Iteruje po tablicy i tworzy element widoku dla każdego elementu. Zwraca tablicę elementów — można jej użyć bezpośrednio jako dziecka `wiersz`/`kolumna`. Klucze Reacta są przypisywane automatycznie.

```
kolumna({ odstęp: "8px" }, [
    dlaKażdego owoc z owoce: akapit(owoc)
])
```

Zmienna iteratora (`owoc`) jest dostępna w wyrażeniu po `:`. Można jej użyć do odczytu pól obiektu przez `iterator.pole`.

```
dla każdego zadanie z zadania:
    wiersz([pogrubienie(zadanie.tytuł), akapit(zadanie.opis)])
```

### `zakres(n)` / `zakres(od, do)`
Funkcja wbudowana zwracająca tablicę liczb całkowitych. Przydatna jako źródło dla `dlaKażdego`.

| Wywołanie | Wynik |
|---|---|
| `zakres(4)` | `[0, 1, 2, 3]` |
| `zakres(1, 5)` | `[1, 2, 3, 4]` |

```
// Nagłówki h1–h4:
dlaKażdego i z zakres(1, 5): nagłówek(i, "Sekcja " + i)
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
- Gdy zmienna pojawia się w swoim własnym przypisaniu (`ustaw x na x + 1`), kompilator automatycznie generuje formę funkcyjną `setX(prev => prev + 1)` – dzięki temu timery z `setInterval` działają poprawnie bez przestarzałych domknięć.
- Wszystkie klucze identyfikatorowe w literałach obiektów są tłumaczone przez mapę CSS w czasie kompilacji.
