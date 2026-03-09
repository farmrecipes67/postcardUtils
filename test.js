const { createPostcardBackSheet, DEFAULT_OPTIONS } = require('./index');

async function runTest() {
  console.log('Testing postcardUtils...');
  console.log('Default options:', JSON.stringify(DEFAULT_OPTIONS, null, 2));

  try {
    const backPdf = await createPostcardBackSheet({
      messages: [
        'Wish you were here! The weather is amazing.',
        'Happy Birthday! Hope your day is wonderful.',
        'Greetings from the farm! Fresh eggs daily.',
        'Thank you for everything!'
      ],
      toAddresses: [
        'Jane Doe\n123 Main St\nDenver, CO 80202'
      ],
      fromAddresses: [
        'Farm Recipes\n100 Farm Ln\nLongmont, CO 80501'
      ]
    });
    console.log('Back PDF generated:', backPdf.length, 'bytes');
    console.log('All tests passed!');
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
