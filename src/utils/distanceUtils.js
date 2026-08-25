export function getMockDistance() {
  // Return random realistic distances for testing
  const distances = ['1.2', '2.5', '3.8', '5.1', '7.3', '9.5'];
  return distances[Math.floor(Math.random() * distances.length)];
}

export function formatDistance(km) {
  return ` ${km} km away`;
}
