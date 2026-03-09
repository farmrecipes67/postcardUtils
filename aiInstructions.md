# aiInstructions.md

## Module Header

| Field | Value |
|---|---|
| **Module** | `postcardUtils` |
| **Purpose** | Generates printable postcard PDF sheets (front images + back text/addresses) with crop marks, arranged in a grid layout on standard pages. |
| **Entry Point** | `index.js` |
| **Primary Dependency** | `pdf-lib` |

---

## Exports

### Constants

#### `POINTS_PER_INCH`
- **Type:** `number`
- **Value:** `72`
- **Usage:** Unit conversion reference. 1 inch = 72 PDF points.

#### `DEFAULT_OPTIONS`
- **Type:** `PostcardOptions`
- **Usage:** Reference object for all default configuration values. Do not mutate.

### Utility Functions

#### `inchesToPoints`

```
inchesToPoints(inches: number): number
```

| Param | Type | Required | Description |
|---|---|---|---|
| `inches` | `number` | Yes | Value in inches |

- **Returns:** `number` — Value in PDF points (`inches * 72`)
- **When to invoke:** When constructing custom `options` objects with dimensional values specified in inches.
- **Constraints:** None. Pure arithmetic.
- **Side effects:** None.
- **Dependencies:** None.

---

### Primary Functions

#### `createPostcardFrontSheet`

```
createPostcardFrontSheet({ images, options? }): Promise<Buffer>
```

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `images` | `Array<string \| Buffer>` | **Yes** | — | 1–N image sources (URL strings, data URIs, `Buffer`, or `Uint8Array`). Supported formats: PNG, JPEG only. |
| `options` | `Partial<PostcardOptions>` | No | `{}` | Configuration overrides merged with `DEFAULT_OPTIONS`. |

- **Returns:** `Promise<Buffer>` — Complete PDF file bytes as a Node.js `Buffer`. Single page containing a grid of postcard fronts.
- **When to invoke:** When generating a printable PDF sheet of postcard front sides (image-only faces).
- **Constraints:**
  - `images` must be a non-empty array.
  - `images.length` must not exceed grid capacity (`Math.floor(pageWidth/cardWidth) * Math.floor(pageHeight/cardHeight)`). Default grid: 1 col × 2 rows = 2 cards max.
  - Only PNG and JPEG images are supported (detected via magic bytes).
  - URL string images require `globalThis.fetch` or `node-fetch` package.
  - Data URIs must be base64-encoded.
  - Slots beyond `images.length` are left blank.
- **Side effects:** Network I/O if image sources are URLs.
- **Dependencies:**
  - `pdf-lib` (imported internally)
  - `globalThis.fetch` OR `node-fetch` — required only when `images` contains URL strings (not Buffers).

---

#### `createPostcardBackSheet`

```
createPostcardBackSheet({ messages?, toAddresses?, fromAddresses?, options? }): Promise<Buffer>
```

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `messages` | `string[]` | No | `[]` | Message text per card. Supports `\n` for line breaks. Placed on left side of card back. |
| `toAddresses` | `string[]` | No | `[]` | Recipient address per card. Lines separated by `\n`. Placed center-right of card back in bold. |
| `fromAddresses` | `string[]` | No | `[]` | Return address per card. Lines separated by `\n`. Placed top-left of right side in small font. |
| `options` | `Partial<PostcardOptions>` | No | `{}` | Configuration overrides merged with `DEFAULT_OPTIONS`. |

- **Returns:** `Promise<Buffer>` — Complete PDF file bytes as a Node.js `Buffer`. Single page containing a grid of postcard backs.
- **When to invoke:** When generating a printable PDF sheet of postcard back sides (message + address faces).
- **Constraints:**
  - At least one of `messages`, `toAddresses`, or `fromAddresses` must be non-empty.
  - Card count is `Math.max(messages.length, toAddresses.length, fromAddresses.length)`.
  - Card count must not exceed grid capacity.
  - Missing entries (index beyond array length) render as blank for that field.
  - Arrays must be of type `Array` (validated).
- **Side effects:** None.
- **Dependencies:**
  - `pdf-lib` (imported internally)
  - Embeds `Helvetica` and `HelveticaBold` standard fonts (no external font files required).

**Layout specification (per card back):**
- Vertical divider at `dividerPosition` (default 0.5) splits card into left/right.
- Left side: message text, word-wrapped to fit.
- Right side top-left: return address (small font, `returnAddressFontSize`).
- Right side top-right: stamp box outline with gray "STAMP" label.
- Right side center-lower: recipient address (bold, `toAddressFontSize`) with horizontal address lines.

---

#### `createPostcardPair`

```
createPostcardPair({ images, messages?, toAddresses?, fromAddresses?, options? }): Promise<{ frontPdf: Buffer, backPdf: Buffer }>
```

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `images` | `Array<string \| Buffer>` | **Yes** | — | Image sources for front sheet. Same constraints as `createPostcardFrontSheet`. |
| `messages` | `string[]` | No | `[]` | Message strings for back sheet. |
| `toAddresses` | `string[]` | No | `[]` | Recipient addresses for back sheet. |
| `fromAddresses` | `string[]` | No | `[]` | Return addresses for back sheet. |
| `options` | `Partial<PostcardOptions>` | No | `{}` | Configuration overrides applied to both sheets. |

- **Returns:** `Promise<{ frontPdf: Buffer, backPdf: Buffer }>` — Object with two properties, each a complete PDF `Buffer`.
- **When to invoke:** When both front and back sheets are needed simultaneously. Preferred over calling `createPostcardFrontSheet` and `createPostcardBackSheet` separately when both are required, as options are validated once and both sheets are generated concurrently via `Promise.all`.
- **Constraints:**
  - `images` must be a non-empty array (validated before delegation).
  - All constraints from both `createPostcardFrontSheet` and `createPostcardBackSheet` apply.
  - Back sheet requires at least one non-empty array among `messages`, `toAddresses`, `fromAddresses` — if all three are empty, the back sheet call will throw.
- **Side effects:** Network I/O if image sources are URLs.
- **Dependencies:** Same as `createPostcardFrontSheet` + `createPostcardBackSheet` combined.

---

## PostcardOptions Schema

All dimensional values are in PDF points (72 points = 1 inch) unless otherwise noted.

| Property | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `pageWidth` | `number` | `612` (8.5in) | positive finite | Page width |
| `pageHeight` | `number` | `792` (11in) | positive finite | Page height |
| `cardWidth` | `number` | `396` (5.5in) | positive finite; must fit ≥1 column on page | Card width |
| `cardHeight` | `number` | `306` (4.25in) | positive finite; must fit ≥1 row on page | Card height |
| `cardRotation` | `number` | `90` | finite | Content rotation in degrees |
| `innerMargin` | `number` | `9` (0.125in) | positive finite | Margin inside card edges |
| `cropMarks` | `boolean` | `true` | — | Whether to draw crop marks |
| `cropMarkLength` | `number` | `18` (0.25in) | positive finite | Length of crop marks |
| `cropMarkOffset` | `number` | `0` | — | Offset of crop marks from card edge |
| `cropMarkWidth` | `number` | `0.5` | positive finite | Stroke width of crop marks |
| `stampBoxWidth` | `number` | `54` (0.75in) | positive finite | Stamp box width |
| `stampBoxHeight` | `number` | `54` (0.75in) | positive finite | Stamp box height |
| `dividerPosition` | `number` | `0.5` | `(0, 1)` exclusive | Vertical divider position as fraction of content width |
| `fontSize` | `number` | `10` | positive finite | Default font size |
| `returnAddressFontSize` | `number` | `7` | positive finite | Return address font size |
| `toAddressFontSize` | `number` | `10` | positive finite | Recipient address font size |
| `messageFontSize` | `number` | `10` | positive finite | Message text font size |
| `lineSpacing` | `number` | `1.4` | positive finite | Line spacing multiplier |

---

## Invocation Syntax

```js
const { createPostcardFrontSheet, createPostcardBackSheet, createPostcardPair, inchesToPoints, DEFAULT_OPTIONS, POINTS_PER_INCH } = require('postcardUtils');
```

```js
const frontPdf = await createPostcardFrontSheet({ images: [buffer1, buffer2] });
```

```js
const backPdf = await createPostcardBackSheet({ messages: ['Hello'], toAddresses: ['Line1\nLine2'], fromAddresses: ['Sender\nAddr'] });
```

```js
const { frontPdf, backPdf } = await createPostcardPair({ images: [buffer1], messages: ['Hello'], toAddresses: ['Addr'], fromAddresses: ['Sender'] });
```

---

## Decision Matrix

| Condition | Function to Call |
|---|---|
| Need only front (image) sheet | `createPostcardFrontSheet` |
| Need only back (text/address) sheet | `createPostcardBackSheet` |
| Need both front and back sheets | `createPostcardPair` |
| Need to convert inches to points for custom options | `inchesToPoints` |
| Need to inspect default configuration | Read `DEFAULT_OPTIONS` |

---

## Error Conditions Summary

| Error Trigger | Thrown By |
|---|---|
| `images` not an array or empty | `createPostcardFrontSheet`, `createPostcardPair` |
| Image count exceeds grid capacity | `createPostcardFrontSheet` |
| All of `messages`, `toAddresses`, `fromAddresses` empty | `createPostcardBackSheet` |
| Card count exceeds grid capacity | `createPostcardBackSheet` |
| Card dimensions do not fit on page | `validateOptions` (all functions) |
| `dividerPosition` not in `(0, 1)` | `validateOptions` |
| Any positive-number option is non-positive/non-finite | `validateOptions` |
| Unsupported image format (not PNG/JPEG) | `embedImage` via `detectImageType` |
| No fetch implementation for URL images | `fetchImageData` |
| Fetch returns non-OK status | `fetchImageData` |
| Invalid data URI format | `fetchImageData` |