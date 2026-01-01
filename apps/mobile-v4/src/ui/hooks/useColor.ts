import { useColorScheme } from 'react-native';
import { Colors } from '../tokens/colors';

export function useColor(
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
  props?: { light?: string; dark?: string }
) {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colorFromProps = props?.[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
