const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');

/**
 * Conversion factor: 1 inch = 72 PDF points
 * @constant {number}
 */
const POINTS_PER_INCH = 72;

/**
 * Converts inches to PDF points
 * @param {number} inches - Value in inches
 * @returns {number} Value in PDF points
 */
function inchesToPoints(inches) {
  return inches * POINTS_PER_INCH;
}

/**
 * Default options for postcard generation.
 * All dimensional values are in PDF points unless noted otherwise.
 * @typedef {Object} PostcardOptions
 * @property {number} pageWidth - Page width in points (default: 612 = 8.5in)
 * @property {number} pageHeight - Page height in points (default: 792 = 11in)
 * @property {number} cardWidth - Card width in points (default: 396 = 5.5in)
 * @property {number} cardHeight - Card height in points (default: 306 = 4.25in)
 * @property {number} cardRotation - Card content rotation in degrees (default: 90)
 * @property {number} innerMargin - Inner margin on card edges in points (default: 9 = 0.125in)
 * @property {boolean} cropMarks - Whether to draw crop marks (default: true)
 * @property {number} cropMarkLength - Length of crop marks in points (default: 18 = 0.25in)
 * @property {number} cropMarkOffset - Offset of crop marks from card edge in points (default: 0)
 * @property {number} cropMarkWidth - Line width of crop marks in points (default: 0.5)
 * @property {number} stampBoxWidth - Width of stamp box in points (default: 54 = 0.75in)
 * @property {number} stampBoxHeight - Height of stamp box in points (default: 54 = 0.75in)
 * @property {number} dividerPosition - Horizontal divider position as fraction of card width (default: 0.5)
 * @property {number} fontSize - Default font size for text in points (default: 10)
 * @property {number} returnAddressFontSize - Font size for return address in points (default: 7)
 * @property {number} toAddressFontSize - Font size for recipient address in points (default: 10)
 * @property {number} messageFontSize - Font size for message text in points (default: 10)
 * @property {number} lineSpacing - Line spacing multiplier (default: 1.4)
 */
const DEFAULT_OPTIONS = {
  pageWidth: inchesToPoints(8.5),
  pageHeight: inchesToPoints(11),
  cardWidth: inchesToPoints(5.5),
  cardHeight: inchesToPoints(4.25),
  cardRotation: 90,
  innerMargin: inchesToPoints(0.125),
  cropMarks: true,
  cropMarkLength: inchesToPoints(0.25),
  cropMarkOffset: 0,
  cropMarkWidth: 0.5,
  stampBoxWidth: inchesToPoints(0.75),
  stampBoxHeight: inchesToPoints(0.75),
  dividerPosition: 0.5,
  fontSize: 10,
  returnAddressFontSize: 7,
  toAddressFontSize: 10,
  messageFontSize: 10,
  lineSpacing: 1.4,
};

/**
 * Merges user-provided options with defaults.
 * @param {Partial<PostcardOptions>} [userOptions={}] - User-provided options
 * @returns {PostcardOptions} Merged options
 */
function mergeOptions(userOptions = {}) {
  return { ...DEFAULT_OPTIONS, ...userOptions };
}

/**
 * Validates that a value is a positive finite number.
 * @param {*} value - Value to check
 * @param {string} name - Parameter name for error messages
 * @throws {Error} If value is not a positive finite number
 */
function validatePositiveNumber(value, name) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    throw new Error(`postcardUtils: "${name}" must be a positive finite number. Received: ${value}`);
  }
}

/**
 * Validates the common options object.
 * @param {PostcardOptions} opts - Options to validate
 * @throws {Error} If any option is invalid
 */
function validateOptions(opts) {
  validatePositiveNumber(opts.pageWidth, 'pageWidth');
  validatePositiveNumber(opts.pageHeight, 'pageHeight');
  validatePositiveNumber(opts.cardWidth, 'cardWidth');
  validatePositiveNumber(opts.cardHeight, 'cardHeight');
  validatePositiveNumber(opts.innerMargin, 'innerMargin');
  validatePositiveNumber(opts.cropMarkLength, 'cropMarkLength');
  validatePositiveNumber(opts.cropMarkWidth, 'cropMarkWidth');
  validatePositiveNumber(opts.stampBoxWidth, 'stampBoxWidth');
  validatePositiveNumber(opts.stampBoxHeight, 'stampBoxHeight');
  validatePositiveNumber(opts.fontSize, 'fontSize');
  validatePositiveNumber(opts.returnAddressFontSize, 'returnAddressFontSize');
  validatePositiveNumber(opts.toAddressFontSize, 'toAddressFontSize');
  validatePositiveNumber(opts.messageFontSize, 'messageFontSize');
  validatePositiveNumber(opts.lineSpacing, 'lineSpacing');

  if (typeof opts.cardRotation !== 'number' || !isFinite(opts.cardRotation)) {
    throw new Error(`postcardUtils: "cardRotation" must be a finite number. Received: ${opts.cardRotation}`);
  }

  if (typeof opts.dividerPosition !== 'number' || opts.dividerPosition <= 0 || opts.dividerPosition >= 1) {
    throw new Error(`postcardUtils: "dividerPosition" must be a number between 0 and 1 (exclusive). Received: ${opts.dividerPosition}`);
  }

  const requiredColumns = Math.floor(opts.pageWidth / opts.cardWidth);
  const requiredRows = Math.floor(opts.pageHeight / opts.cardHeight);
  if (requiredColumns < 1 || requiredRows < 1) {
    throw new Error(
      `postcardUtils: Card dimensions (${opts.cardWidth}x${opts.cardHeight}pt) do not fit on page (${opts.pageWidth}x${opts.pageHeight}pt). ` +
      `Need at least 1 column and 1 row.`
    );
  }
}

/**
 * Computes the grid positions of cards on the page.
 * Cards are arranged in a grid, centered on the page.
 * @param {PostcardOptions} opts - Options
 * @returns {{ positions: Array<{x: number, y: number, col: number, row: number}>, cols: number, rows: number }}
 */
function computeCardGrid(opts) {
  const cols = Math.floor(opts.pageWidth / opts.cardWidth);
  const rows = Math.floor(opts.pageHeight / opts.cardHeight);
  const totalCardsWidth = cols * opts.cardWidth;
  const totalCardsHeight = rows * opts.cardHeight;
  const offsetX = (opts.pageWidth - totalCardsWidth) / 2;
  const offsetY = (opts.pageHeight - totalCardsHeight) / 2;

  const positions = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: offsetX + col * opts.cardWidth,
        y: offsetY + (rows - 1 - row) * opts.cardHeight,
        col,
        row,
      });
    }
  }

  return { positions, cols, rows };
}

/**
 * Draws crop marks at all card boundaries on the page.
 * @param {import('pdf-lib').PDFPage} page - The PDF page to draw on
 * @param {PostcardOptions} opts - Options
 */
function drawCropMarks(page, opts) {
  if (!opts.cropMarks) return;

  const { positions, cols, rows } = computeCardGrid(opts);
  const totalCardsWidth = cols * opts.cardWidth;
  const totalCardsHeight = rows * opts.cardHeight;
  const offsetX = (opts.pageWidth - totalCardsWidth) / 2;
  const offsetY = (opts.pageHeight - totalCardsHeight) / 2;

  const color = rgb(0, 0, 0);
  const thickness = opts.cropMarkWidth;
  const len = opts.cropMarkLength;
  const markOffset = opts.cropMarkOffset;

  const drawnLines = new Set();

  function drawLine(x1, y1, x2, y2) {
    const key = `${x1.toFixed(2)},${y1.toFixed(2)},${x2.toFixed(2)},${y2.toFixed(2)}`;
    if (drawnLines.has(key)) return;
    drawnLines.add(key);
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness,
      color,
    });
  }

  // Vertical crop marks at each column boundary
  for (let col = 0; col <= cols; col++) {
    const x = offsetX + col * opts.cardWidth;
    // Top edge of grid
    const topY = offsetY + totalCardsHeight;
    drawLine(x, topY + markOffset, x, topY + markOffset + len);
    // Bottom edge of grid
    const bottomY = offsetY;
    drawLine(x, bottomY - markOffset, x, bottomY - markOffset - len);
    // Internal horizontal boundaries
    for (let row = 1; row < rows; row++) {
      const y = offsetY + row * opts.cardHeight;
      drawLine(x, y + markOffset, x, y + markOffset + len);
      drawLine(x, y - markOffset, x, y - markOffset - len);
    }
  }

  // Horizontal crop marks at each row boundary
  for (let row = 0; row <= rows; row++) {
    const y = offsetY + row * opts.cardHeight;
    // Left edge of grid
    const leftX = offsetX;
    drawLine(leftX - markOffset, y, leftX - markOffset - len, y);
    // Right edge of grid
    const rightX = offsetX + totalCardsWidth;
    drawLine(rightX + markOffset, y, rightX + markOffset + len, y);
    // Internal vertical boundaries
    for (let col = 1; col < cols; col++) {
      const x = offsetX + col * opts.cardWidth;
      drawLine(x + markOffset, y, x + markOffset + len, y);
      drawLine(x - markOffset, y, x - markOffset - len, y);
    }
  }
}

/**
 * Fetches image data from a URL string or returns a Buffer as-is.
 * @param {string|Buffer} imageSource - URL string or Buffer containing image data
 * @returns {Promise<Buffer>} Image data as a Buffer
 * @throws {Error} If the image source is invalid or fetch fails
 */
async function fetchImageData(imageSource) {
  if (Buffer.isBuffer(imageSource)) {
    return imageSource;
  }
  if (typeof imageSource === 'string') {
    if (imageSource.startsWith('data:')) {
      const base64Match = imageSource.match(/^data:[^;]+;base64,(.+)$/);
      if (base64Match) {
        return Buffer.from(base64Match[1], 'base64');
      }
      throw new Error(`postcardUtils: Unsupported data URI format.`);
    }
    // Attempt fetch (works with http, https URLs)
    let fetchFn;
    try {
      fetchFn = globalThis.fetch || require('node-fetch');
    } catch (e) {
      throw new Error(
        'postcardUtils: No fetch implementation available. Install "node-fetch" or use Node.js >= 18 with native fetch, or pass image data as Buffers.'
      );
    }
    const response = await fetchFn(imageSource);
    if (!response.ok) {
      throw new Error(`postcardUtils: Failed to fetch image from "${imageSource}". Status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (imageSource instanceof Uint8Array) {
    return Buffer.from(imageSource);
  }
  throw new Error(`postcardUtils: Image source must be a URL string, Buffer, or Uint8Array. Received: ${typeof imageSource}`);
}

/**
 * Detects image type from buffer magic bytes.
 * @param {Buffer} buffer - Image data
 * @returns {'png'|'jpg'} Detected image type
 * @throws {Error} If image type cannot be detected
 */
function detectImageType(buffer) {
  if (buffer.length < 4) {
    throw new Error('postcardUtils: Image buffer is too small to detect type.');
  }
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  throw new Error(
    'postcardUtils: Unsupported image format. Only PNG and JPEG are supported by pdf-lib. ' +
    'First bytes: ' + buffer.slice(0, 4).toString('hex')
  );
}

/**
 * Embeds an image into a PDF document, auto-detecting format.
 * @param {import('pdf-lib').PDFDocument} pdfDoc - The PDF document
 * @param {Buffer} imageBuffer - Image data
 * @returns {Promise<import('pdf-lib').PDFImage>} Embedded image
 */
async function embedImage(pdfDoc, imageBuffer) {
  const type = detectImageType(imageBuffer);
  if (type === 'png') {
    return pdfDoc.embedPng(imageBuffer);
  }
  return pdfDoc.embedJpg(imageBuffer);
}

/**
 * Calculates contain-fit (letterbox) dimensions for an image within a given area.
 * The image is scaled to fit entirely within the area while maintaining aspect ratio.
 * @param {number} imgWidth - Original image width
 * @param {number} imgHeight - Original image height
 * @param {number} areaWidth - Available area width
 * @param {number} areaHeight - Available area height
 * @returns {{ width: number, height: number, x: number, y: number }} Fitted dimensions and offset within area
 */
function containFit(imgWidth, imgHeight, areaWidth, areaHeight) {
  const imgAspect = imgWidth / imgHeight;
  const areaAspect = areaWidth / areaHeight;

  let width, height;
  if (imgAspect > areaAspect) {
    // Image is wider than area (relative to height) — fit to width
    width = areaWidth;
    height = areaWidth / imgAspect;
  } else {
    // Image is taller than area (relative to width) — fit to height
    height = areaHeight;
    width = areaHeight * imgAspect;
  }

  const x = (areaWidth - width) / 2;
  const y = (areaHeight - height) / 2;

  return { width, height, x, y };
}

/**
 * Wraps text to fit within a maximum width, breaking on word boundaries.
 * @param {string} text - The text to wrap
 * @param {import('pdf-lib').PDFFont} font - The font to measure with
 * @param {number} fontSize - Font size in points
 * @param {number} maxWidth - Maximum line width in points
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(text, font, fontSize, maxWidth) {
  const lines = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Creates a PDF sheet with postcard front images.
 *
 * Each image is placed on a card slot, contain-fitted (letterboxed) within
 * the card area (minus inner margins), and rotated according to cardRotation.
 * Crop marks are drawn at card boundaries if enabled.
 *
 * @param {Object} params - Parameters
 * @param {Array<string|Buffer>} params.images - Array of 1-4 image sources (URL strings or Buffers).
 *   Supported formats: PNG, JPEG. If fewer than the grid capacity, remaining slots are left blank.
 * @param {Partial<PostcardOptions>} [params.options={}] - Optional configuration overrides
 * @returns {Promise<Buffer>} PDF file as a Node.js Buffer
 * @throws {Error} If images array is empty, or images cannot be loaded/embedded
 *
 * @example
 * const fs = require('fs');
 * const { createPostcardFrontSheet } = require('postcardUtils');
 *
 * const pdfBuffer = await createPostcardFrontSheet({
 *   images: [fs.readFileSync('photo1.jpg'), fs.readFileSync('photo2.png')],
 *   options: { cropMarks: true }
 * });
 * fs.writeFileSync('fronts.pdf', pdfBuffer);
 */
async function createPostcardFrontSheet({ images, options = {} } = {}) {
  // Input validation
  if (!images || !Array.isArray(images)) {
    throw new Error('postcardUtils.createPostcardFrontSheet: "images" must be an array of image sources (URL strings or Buffers).');
  }
  if (images.length === 0) {
    throw new Error('postcardUtils.createPostcardFrontSheet: "images" array must contain at least 1 image.');
  }

  const opts = mergeOptions(options);
  validateOptions(opts);

  const { positions, cols, rows } = computeCardGrid(opts);
  const maxCards = cols * rows;

  if (images.length > maxCards) {
    throw new Error(
      `postcardUtils.createPostcardFrontSheet: Too many images (${images.length}). ` +
      `Page layout supports ${maxCards} cards (${cols} columns x ${rows} rows).`
    );
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([opts.pageWidth, opts.pageHeight]);

  // Draw crop marks
  drawCropMarks(page, opts);

  // Place images
  for (let i = 0; i < images.length; i++) {
    const imageBuffer = await fetchImageData(images[i]);
    const embeddedImage = await embedImage(pdfDoc, imageBuffer);
    const pos = positions[i];

    const margin = opts.innerMargin;
    const contentWidth = opts.cardWidth - 2 * margin;
    const contentHeight = opts.cardHeight - 2 * margin;

    // The card center
    const centerX = pos.x + opts.cardWidth / 2;
    const centerY = pos.y + opts.cardHeight / 2;

    const rotation = opts.cardRotation;
    const rotRad = (rotation * Math.PI) / 180;

    // When rotated, the available drawing area swaps dimensions
    // For 90 degree rotation: what was width becomes height and vice versa
    let drawAreaWidth, drawAreaHeight;
    if (Math.abs(rotation % 180) === 90) {
      drawAreaWidth = contentHeight;
      drawAreaHeight = contentWidth;
    } else if (rotation % 180 === 0) {
      drawAreaWidth = contentWidth;
      drawAreaHeight = contentHeight;
    } else {
      // For arbitrary rotations, use the inscribed rectangle
      // This is an approximation — use the minimum of both projections
      const absC = Math.abs(Math.cos(rotRad));
      const absS = Math.abs(Math.sin(rotRad));
      drawAreaWidth = contentWidth * absC + contentHeight * absS;
      drawAreaHeight = contentWidth * absS + contentHeight * absC;
      // Actually, we need to fit inside the content area, so we need the inverse
      // For arbitrary angles, compute max drawable size
      if (absC > 0 && absS > 0) {
        drawAreaWidth = Math.min(contentWidth / absC, contentHeight / absS);
        drawAreaHeight = Math.min(contentHeight / absC, contentWidth / absS);
      }
    }

    // Contain-fit the image within the drawable area
    const fit = containFit(embeddedImage.width, embeddedImage.height, drawAreaWidth, drawAreaHeight);

    // Draw the image rotated around the card center
    // pdf-lib drawImage x,y is bottom-left of the image (before rotation)
    // When rotating around a point, we need to position relative to that point
    page.drawImage(embeddedImage, {
      x: centerX - fit.width / 2,
      y: centerY - fit.height / 2,
      width: fit.width,
      height: fit.height,
      rotate: degrees(rotation),
      xSkew: degrees(0),
      ySkew: degrees(0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Creates a PDF sheet with postcard back content (messages, addresses, stamp boxes).
 *
 * Each card back is divided by a vertical line at dividerPosition. The left side
 * contains the message text, and the right side contains the return address (top-left),
 * a stamp box (top-right), and the recipient address (centered-right).
 * Content is rotated according to cardRotation.
 *
 * @param {Object} params - Parameters
 * @param {string[]} [params.messages=[]] - Array of 1-4 message strings. May contain newlines.
 * @param {string[]} [params.toAddresses=[]] - Array of 1-4 recipient address strings (lines separated by \n)
 * @param {string[]} [params.fromAddresses=[]] - Array of 1-4 return address strings (lines separated by \n)
 * @param {Partial<PostcardOptions>} [params.options={}] - Optional configuration overrides
 * @returns {Promise<Buffer>} PDF file as a Node.js Buffer
 * @throws {Error} If input validation fails
 *
 * @example
 * const { createPostcardBackSheet } = require('postcardUtils');
 *
 * const pdfBuffer = await createPostcardBackSheet({
 *   messages: ['Wish you were here!', 'Having a great time!'],
 *   toAddresses: ['Jane Doe\n123 Main St\nAnytown, ST 12345'],
 *   fromAddresses: ['John Smith\n456 Oak Ave\nOthertown, ST 67890'],
 * });
 */
async function createPostcardBackSheet({ messages = [], toAddresses = [], fromAddresses = [], options = {} } = {}) {
  if (!Array.isArray(messages)) {
    throw new Error('postcardUtils.createPostcardBackSheet: "messages" must be an array of strings.');
  }
  if (!Array.isArray(toAddresses)) {
    throw new Error('postcardUtils.createPostcardBackSheet: "toAddresses" must be an array of strings.');
  }
  if (!Array.isArray(fromAddresses)) {
    throw new Error('postcardUtils.createPostcardBackSheet: "fromAddresses" must be an array of strings.');
  }

  const opts = mergeOptions(options);
  validateOptions(opts);

  const { positions, cols, rows } = computeCardGrid(opts);
  const maxCards = cols * rows;

  const cardCount = Math.max(messages.length, toAddresses.length, fromAddresses.length);
  if (cardCount === 0) {
    throw new Error('postcardUtils.createPostcardBackSheet: At least one of messages, toAddresses, or fromAddresses must be non-empty.');
  }
  if (cardCount > maxCards) {
    throw new Error(
      `postcardUtils.createPostcardBackSheet: Too many cards requested (${cardCount}). ` +
      `Page layout supports ${maxCards} cards (${cols} columns x ${rows} rows).`
    );
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([opts.pageWidth, opts.pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw crop marks
  drawCropMarks(page, opts);

  for (let i = 0; i < cardCount; i++) {
    const pos = positions[i];
    const message = messages[i] || '';
    const toAddress = toAddresses[i] || '';
    const fromAddress = fromAddresses[i] || '';

    const margin = opts.innerMargin;
    const rotation = opts.cardRotation;

    // Card center
    const centerX = pos.x + opts.cardWidth / 2;
    const centerY = pos.y + opts.cardHeight / 2;

    // When rotated 90°, the content coordinate system is rotated.
    // We'll draw everything in an unrotated "content space" and then
    // use pdf-lib's page drawing with manual coordinate transforms.
    //
    // For the back of a postcard, content is laid out in landscape orientation
    // within the card. With 90° rotation, the card's physical dimensions swap
    // for content purposes.

    let contentW, contentH;
    if (Math.abs(rotation % 180) === 90) {
      contentW = opts.cardHeight - 2 * margin;
      contentH = opts.cardWidth - 2 * margin;
    } else {
      contentW = opts.cardWidth - 2 * margin;
      contentH = opts.cardHeight - 2 * margin;
    }

    // We draw using a helper that transforms content-space coordinates to page-space.
    // Content space: origin at top-left of content area, x right, y down.
    // We need to map this to page coordinates (origin bottom-left, y up) with rotation.

    const rotRad = (rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    /**
     * Transforms content-space coordinates to page-space.
     * Content space: (0,0) is top-left of content, x goes right, y goes down.
     * @param {number} cx - Content x
     * @param {number} cy - Content y
     * @returns {{x: number, y: number}} Page coordinates
     */
    function toPage(cx, cy) {
      // First, map to content-centered coordinates
      const ccx = cx - contentW / 2;
      const ccy = -(cy - contentH / 2); // flip y for PDF

      // Rotate
      const rx = ccx * cosR - ccy * sinR;
      const ry = ccx * sinR + ccy * cosR;

      // Translate to page
      return {
        x: centerX + rx,
        y: centerY + ry,
      };
    }

    /**
     * Draws text in content space with the card rotation.
     * @param {string} text - Text to draw
     * @param {number} cx - Content x (left edge of text in content space)
     * @param {number} cy - Content y (baseline in content space, measured from top)
     * @param {import('pdf-lib').PDFFont} textFont - Font
     * @param {number} size - Font size
     * @param {Object} [color] - Color (default black)
     */
    function drawText(text, cx, cy, textFont, size, color = rgb(0, 0, 0)) {
      const p = toPage(cx, cy);
      page.drawText(text, {
        x: p.x,
        y: p.y,
        size,
        font: textFont,
        color,
        rotate: degrees(rotation),
      });
    }

    /**
     * Draws a line in content space.
     * @param {number} x1 - Start x in content space
     * @param {number} y1 - Start y in content space
     * @param {number} x2 - End x in content space
     * @param {number} y2 - End y in content space
     * @param {number} [thickness=0.5] - Line thickness
     */
    function drawLine(x1, y1, x2, y2, thickness = 0.5) {
      const p1 = toPage(x1, y1);
      const p2 = toPage(x2, y2);
      page.drawLine({
        start: p1,
        end: p2,
        thickness,
        color: rgb(0, 0, 0),
      });
    }

    /**
     * Draws a rectangle outline in content space.
     * @param {number} x - Left x
     * @param {number} y - Top y
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} [thickness=0.5] - Line thickness
     */
    function drawRect(x, y, w, h, thickness = 0.5) {
      drawLine(x, y, x + w, y, thickness);
      drawLine(x + w, y, x + w, y + h, thickness);
      drawLine(x + w, y + h, x, y + h, thickness);
      drawLine(x, y + h, x, y, thickness);
    }

    // Layout in content space
    const dividerX = contentW * opts.dividerPosition;

    // Draw vertical divider line
    drawLine(dividerX, 0, dividerX, contentH, 0.5);

    // Draw horizontal line on the address side (right half) at roughly the middle
    // Actually, traditional postcards have a horizontal line for the address area
    // We'll add address lines

    // === LEFT SIDE: Message ===
    if (message) {
      const msgMargin = margin;
      const msgAreaWidth = dividerX - 2 * msgMargin;
      const msgAreaHeight = contentH - 2 * msgMargin;
      const msgFontSize = opts.messageFontSize;
      const msgLineHeight = msgFontSize * opts.lineSpacing;

      const wrappedLines = wrapText(message, font, msgFontSize, msgAreaWidth);
      let textY = msgMargin + msgFontSize; // first baseline

      for (const line of wrappedLines) {
        if (textY > contentH - msgMargin) break; // overflow protection
        drawText(line, msgMargin, textY, font, msgFontSize);
        textY += msgLineHeight;
      }
    }

    // === RIGHT SIDE: Addresses & Stamp ===
    const rightMargin = margin;
    const rightX = dividerX + rightMargin;
    const rightWidth = contentW - dividerX - 2 * rightMargin;

    // Stamp box: top-right corner
    const stampW = opts.stampBoxWidth;
    const stampH = opts.stampBoxHeight;
    const stampX = dividerX + (contentW - dividerX) - rightMargin - stampW;
    const stampY = rightMargin;

    drawRect(stampX, stampY, stampW, stampH, 0.5);

    // "STAMP" text centered in stamp box
    const stampText = 'STAMP';
    const stampFontSize = 6;
    const stampTextWidth = font.widthOfTextAtSize(stampText, stampFontSize);
    drawText(
      stampText,
      stampX + (stampW - stampTextWidth) / 2,
      stampY + stampH / 2 + stampFontSize / 3,
      font,
      stampFontSize,
      rgb(0.6, 0.6, 0.6)
    );

    // Return address: top-left of right side
    if (fromAddress) {
      const fromLines = fromAddress.split('\n');
      const fromFontSize = opts.returnAddressFontSize;
      const fromLineHeight = fromFontSize * opts.lineSpacing;
      let fromY = rightMargin + fromFontSize;

      for (const line of fromLines) {
        drawText(line.trim(), rightX, fromY, font, fromFontSize);
        fromY += fromLineHeight;
      }
    }

    // Recipient address: centered in the lower portion of the right side
    if (toAddress) {
      const toLines = toAddress.split('\n');
      const toFontSize = opts.toAddressFontSize;
      const toLineHeight = toFontSize * opts.lineSpacing;
      const toBlockHeight = toLines.length * toLineHeight;

      // Position: vertically centered in the lower 60% of the right side
      const addressAreaTop = contentH * 0.35;
      const addressAreaBottom = contentH - rightMargin;
      const addressAreaHeight = addressAreaBottom - addressAreaTop;
      let toY = addressAreaTop + (addressAreaHeight - toBlockHeight) / 2 + toFontSize;

      // Draw horizontal address lines
      const lineStartX = rightX;
      const lineEndX = dividerX + (contentW - dividerX) - rightMargin;
      for (let li = 0; li < Math.max(toLines.length, 3); li++) {
        const lineY = addressAreaTop + (li + 1) * (addressAreaHeight / (Math.max(toLines.length, 3) + 0.5));
        drawLine(lineStartX, lineY, lineEndX, lineY, 0.25);
      }

      for (const line of toLines) {
        drawText(line.trim(), rightX + 4, toY, boldFont, toFontSize);
        toY += toLineHeight;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Creates both front and back PDF sheets for a set of postcards.
 *
 * This is a convenience function that calls createPostcardFrontSheet and
 * createPostcardBackSheet with the same options and returns both PDFs.
 *
 * @param {Object} params - Parameters
 * @param {Array<string|Buffer>} params.images - Array of 1-4 image sources for the front
 * @param {string[]} [params.messages=[]] - Array of 1-4 message strings for the back
 * @param {string[]} [params.toAddresses=[]] - Array of 1-4 recipient addresses for the back
 * @param {string[]} [params.fromAddresses=[]] - Array of 1-4 return addresses for the back
 * @param {Partial<PostcardOptions>} [params.options={}] - Optional configuration overrides
 * @returns {Promise<{ frontPdf: Buffer, backPdf: Buffer }>} Object containing both PDF Buffers
 * @throws {Error} If any validation or generation fails
 *
 * @example
 * const fs = require('fs');
 * const { createPostcardPair } = require('postcardUtils');
 *
 * const result = await createPostcardPair({
 *   images: [fs.readFileSync('photo.jpg')],
 *   messages: ['Hello from vacation!'],
 *   toAddresses: ['Jane Doe\n123 Main St\nAnytown, ST 12345'],
 *   fromAddresses: ['John Smith\n456 Oak Ave\nOthertown, ST 67890'],
 * });
 *
 * fs.writeFileSync('front.pdf', result.frontPdf);
 * fs.writeFileSync('back.pdf', result.backPdf);
 */
async function createPostcardPair({ images, messages = [], toAddresses = [], fromAddresses = [], options = {} } = {}) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    throw new Error('postcardUtils.createPostcardPair: "images" must be a non-empty array of image sources.');
  }

  const opts = mergeOptions(options);
  validateOptions(opts);

  const [frontPdf, backPdf] = await Promise.all([
    createPostcardFrontSheet({ images, options: opts }),
    createPostcardBackSheet({ messages, toAddresses, fromAddresses, options: opts }),
  ]);

  return { frontPdf, backPdf };
}

module.exports = {
  createPostcardFrontSheet,
  createPostcardBackSheet,
  createPostcardPair,
  DEFAULT_OPTIONS,
  inchesToPoints,
  POINTS_PER_INCH,
};