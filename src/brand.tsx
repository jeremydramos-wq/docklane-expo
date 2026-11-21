import {Image} from 'react-native';

/** Hauller identity. Backend and native application identifiers stay unchanged. */
export const colour = {
  ink: '#101114', white: '#FFFFFF', cobalt: '#3155F5', cloud: '#F5F6F8',
  slate: '#5D6472', line: '#D9DDE5', softBlue: '#EAF0FF',
  success: '#16643C', successBg: '#E8F3ED',
  warning: '#805300', warningBg: '#FFF3DB',
  danger: '#AA2038', dangerBg: '#FCEBEC',
} as const;

export const font = {
  regular: 'Manrope-Regular', medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold', bold: 'Manrope-Bold', extrabold: 'Manrope-ExtraBold',
} as const;

export const brandFonts = {
  [font.regular]: require('../assets/fonts/Manrope-Regular.ttf'),
  [font.medium]: require('../assets/fonts/Manrope-Medium.ttf'),
  [font.semibold]: require('../assets/fonts/Manrope-SemiBold.ttf'),
  [font.bold]: require('../assets/fonts/Manrope-Bold.ttf'),
  [font.extrabold]: require('../assets/fonts/Manrope-ExtraBold.ttf'),
};

export function HaullerWordmark({width=140,inverse=false}:{width?:number;inverse?:boolean}){
  return <Image accessibilityLabel="Hauller" accessibilityRole="image"
    source={inverse?require('../assets/hauller-wordmark-white.png'):require('../assets/hauller-wordmark-black.png')}
    resizeMode="contain" style={{width,height:width*0.237}}/>;
}
