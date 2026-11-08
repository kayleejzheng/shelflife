import { Image } from 'react-native';

// Grocery-bag mascot from the Figma Login frame
export default function Logo({ height = 200 }: { height?: number }) {
  return (
    <Image
      source={require('../assets/logo.png')}
      style={{ width: height * (177 / 226), height, alignSelf: 'center' }}
      resizeMode="contain"
    />
  );
}
