const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeMarqoCenterCropRect,
  computeMarqoResizeAction,
  MARQO_NSFW_INPUT_SIZE,
} = require('../../src/validation/marqoNsfwPreprocessMath');
const { nsfwCheck } = require('../../src/validation/nsfwCheck');

test('computeMarqoResizeAction scales the shorter edge to 384', () => {
  assert.deepEqual(computeMarqoResizeAction(1920, 1080), { resize: { height: 384 } });
  assert.deepEqual(computeMarqoResizeAction(1080, 1920), { resize: { width: 384 } });
  assert.deepEqual(computeMarqoResizeAction(1000, 1000), { resize: { height: 384 } });
});

test('computeMarqoCenterCropRect centers a 384 square crop', () => {
  assert.deepEqual(computeMarqoCenterCropRect(683, 384), {
    originX: 149,
    originY: 0,
    width: 384,
    height: 384,
  });
  assert.deepEqual(computeMarqoCenterCropRect(384, 384), {
    originX: 0,
    originY: 0,
    width: 384,
    height: 384,
  });
});

test('nsfwCheck classifies the preprocessed inference URI', async () => {
  const calls = [];
  const classifier = {
    async classifyImage(uri) {
      calls.push(uri);
      return [{ text: 'SFW', confidence: 0.97, index: 1 }];
    },
  };

  await nsfwCheck('file://original.jpg', classifier, {
    preprocessMarqoNsfwImage: async () => ({
      uri: 'file://preprocessed-384.png',
      width: MARQO_NSFW_INPUT_SIZE,
      height: MARQO_NSFW_INPUT_SIZE,
      preprocessing: { cropMode: 'center' },
    }),
  });

  assert.deepEqual(calls, ['file://preprocessed-384.png']);
});
