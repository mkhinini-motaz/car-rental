// The agency's theme (`agency.theme`, `agency.theme_mode`), chosen by the owner for every staff member.
// Each palette has a light and a dark scheme. `nav` is the web sidebar and the phone's header,
// `on…` the text on a colour (`on`: on a filled status). The status tones (`ok`, `info`, `warn`,
// `danger`, `mutedFill`, and `ink` for reserved) mean the same in every palette. The ids are
// App\Models\Agency::THEMES; copied as is into ../carweb/src/classes.
export const PALETTES = {
  navy: { // Deep navy frame, calm and trusted.
    light: {
      primary: '#0C3164', onPrimary: '#FFFFFF', nav: '#0C3164', onNav: '#FFFFFF', canvas: '#F3F6FA', surface: '#FFFFFF', line: '#DEE3EB', ink: '#0F1926',
      muted: '#586474', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#BCD2F9', onPrimary: '#14191E', nav: '#162644', onNav: '#FFFFFF', canvas: '#14191E', surface: '#1D2229', line: '#323941', ink: '#E8EBF0',
      muted: '#ADB5C0', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#14191E',
    },
  },
  plate: { // Black and white, like a number plate.
    light: {
      primary: '#1C1F25', onPrimary: '#FFFFFF', nav: '#1C1F25', onNav: '#FFFFFF', canvas: '#F5F4F2', surface: '#FFFFFF', line: '#E4E3DE', ink: '#1A1810',
      muted: '#66635A', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#E9E8E3', onPrimary: '#191814', nav: '#0C0D0F', onNav: '#FFFFFF', canvas: '#191814', surface: '#23221D', line: '#3A3831', ink: '#ECEBE8',
      muted: '#B6B4AC', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#191814',
    },
  },
  noir: { // Black with antique gold, for a luxury fleet.
    light: {
      primary: '#836412', onPrimary: '#FFFFFF', nav: '#161310', onNav: '#FFFFFF', canvas: '#F6F5F2', surface: '#FFFFFF', line: '#E5E3DD', ink: '#1D180E',
      muted: '#686357', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#E8C773', onPrimary: '#1A1814', nav: '#0C0B08', onNav: '#FFFFFF', canvas: '#1A1814', surface: '#24211C', line: '#3B3831', ink: '#ECEBE8',
      muted: '#B8B4AC', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1A1814',
    },
  },
  racing: { // British racing green on warm stone.
    light: {
      primary: '#145538', onPrimary: '#FFFFFF', nav: '#0A3723', onNav: '#FFFFFF', canvas: '#F5F6F2', surface: '#FFFFFF', line: '#E2E4DB', ink: '#161A0A',
      muted: '#616653', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#99D8B6', onPrimary: '#171912', nav: '#0F2D1F', onNav: '#FFFFFF', canvas: '#171912', surface: '#21231B', line: '#37392F', ink: '#EAECE7',
      muted: '#B2B6A9', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#171912',
    },
  },
  oxblood: { // Deep burgundy, like a leather interior.
    light: {
      primary: '#7B242E', onPrimary: '#FFFFFF', nav: '#4D141D', onNav: '#FFFFFF', canvas: '#F9F5F4', surface: '#FFFFFF', line: '#E9E1DF', ink: '#231411',
      muted: '#715E5B', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#EEB2B5', onPrimary: '#1D1615', nav: '#3F181D', onNav: '#FFFFFF', canvas: '#1D1615', surface: '#27201E', line: '#3F3533', ink: '#EFEAE9',
      muted: '#BEB1AF', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1D1615',
    },
  },
  desert: { // Camel and espresso, warm as the Sahara.
    light: {
      primary: '#5A3927', onPrimary: '#FFFFFF', nav: '#C39465', onNav: '#201707', canvas: '#F8F4ED', surface: '#FFFFFF', line: '#EAE2D4', ink: '#201707',
      muted: '#6C6250', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#E6BC8B', onPrimary: '#1E170C', nav: '#2C1E13', onNav: '#FFFFFF', canvas: '#1E170C', surface: '#282014', line: '#403626', ink: '#EFEAE2',
      muted: '#BEB39F', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1E170C',
    },
  },
  electric: { // Midnight indigo with vivid violet.
    light: {
      primary: '#5A37D1', onPrimary: '#FFFFFF', nav: '#15153A', onNav: '#FFFFFF', canvas: '#F4F5FB', surface: '#FFFFFF', line: '#E0E2EE', ink: '#161726',
      muted: '#5F6275', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#AFABFF', onPrimary: '#171720', nav: '#121130', onNav: '#FFFFFF', canvas: '#171720', surface: '#20212B', line: '#353744', ink: '#EAEBF2',
      muted: '#B1B3C4', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#171720',
    },
  },
  rosso: { // Racing red, loud and proud.
    light: {
      primary: '#9B0F1B', onPrimary: '#FFFFFF', nav: '#B7191C', onNav: '#FFFFFF', canvas: '#F9F4F4', surface: '#FFFFFF', line: '#EAE0DF', ink: '#231412',
      muted: '#715E5C', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#FB9890', onPrimary: '#1D1616', nav: '#551112', onNav: '#FFFFFF', canvas: '#1D1616', surface: '#271F1F', line: '#3F3534', ink: '#EFEAE9',
      muted: '#BEB1AF', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1D1616',
    },
  },
  papaya: { // Papaya orange with black, like a McLaren.
    light: {
      primary: '#22150A', onPrimary: '#FFFFFF', nav: '#F58028', onNav: '#22150A', canvas: '#F9F5F2', surface: '#FFFFFF', line: '#E9E1DB', ink: '#22150A',
      muted: '#706052', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#FFA351', onPrimary: '#1D1712', nav: '#1A1512', onNav: '#FFFFFF', canvas: '#1D1712', surface: '#27201B', line: '#3F362F', ink: '#EFEAE6',
      muted: '#BDB2A9', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1D1712',
    },
  },
  taxi: { // Taxi yellow and black.
    light: {
      primary: '#1D1807', onPrimary: '#FFFFFF', nav: '#F7D22A', onNav: '#1D1807', canvas: '#F6F5F1', surface: '#FFFFFF', line: '#E5E3DA', ink: '#1D1807',
      muted: '#686350', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#F9D544', onPrimary: '#1A1811', nav: '#12120F', onNav: '#FFFFFF', canvas: '#1A1811', surface: '#24221A', line: '#3B382E', ink: '#ECEBE6',
      muted: '#B8B4A8', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1A1811',
    },
  },
  gulf: { // Powder blue and orange, the racing livery.
    light: {
      primary: '#BD4D00', onPrimary: '#FFFFFF', nav: '#88C9E2', onNav: '#071B23', canvas: '#F0F7FA', surface: '#FFFFFF', line: '#D8E5EB', ink: '#071B23',
      muted: '#516770', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#F9A870', onPrimary: '#0F1A1E', nav: '#072D3D', onNav: '#FFFFFF', canvas: '#0F1A1E', surface: '#182429', line: '#2B3B41', ink: '#E5EDF0',
      muted: '#A5B8C0', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#0F1A1E',
    },
  },
  sea: { // Turquoise with deep ocean blue.
    light: {
      primary: '#00496B', onPrimary: '#FFFFFF', nav: '#16BBBC', onNav: '#051C1E', canvas: '#F0F7F8', surface: '#FFFFFF', line: '#D7E6E7', ink: '#051C1E',
      muted: '#4F696A', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#6ED9D2', onPrimary: '#0E1B1B', nav: '#002D34', onNav: '#FFFFFF', canvas: '#0E1B1B', surface: '#172525', line: '#293C3D', ink: '#E4EDEE',
      muted: '#A3B9BA', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#0E1B1B',
    },
  },
  rose: { // Vivid pink with deep plum.
    light: {
      primary: '#8A235E', onPrimary: '#FFFFFF', nav: '#CA3A80', onNav: '#FFFFFF', canvas: '#FBF5F7', surface: '#FFFFFF', line: '#EBDFE3', ink: '#231219',
      muted: '#725C64', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#F8A9C7', onPrimary: '#1E1519', nav: '#4E0D2E', onNav: '#FFFFFF', canvas: '#1E1519', surface: '#281E22', line: '#413438', ink: '#F0E9EB',
      muted: '#C0AFB5', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1E1519',
    },
  },
  blossom: { // Blush pink with berry.
    light: {
      primary: '#9B255A', onPrimary: '#FFFFFF', nav: '#FFDCE8', onNav: '#231218', canvas: '#FBF6F8', surface: '#FFFFFF', line: '#EAE0E3', ink: '#231218',
      muted: '#725C63', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#F8AFC7', onPrimary: '#1E1618', nav: '#331821', onNav: '#FFFFFF', canvas: '#1E1618', surface: '#281F22', line: '#403438', ink: '#EFE9EB',
      muted: '#BFB0B4', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1E1618',
    },
  },
  lilac: { // Lilac with deep violet.
    light: {
      primary: '#5637A7', onPrimary: '#FFFFFF', nav: '#D7CCFE', onNav: '#191525', canvas: '#F7F6FC', surface: '#FFFFFF', line: '#E3E1ED', ink: '#191525',
      muted: '#646073', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#BCB2FF', onPrimary: '#191720', nav: '#241E3F', onNav: '#FFFFFF', canvas: '#191720', surface: '#22202A', line: '#393643', ink: '#EBEAF1',
      muted: '#B5B2C2', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#191720',
    },
  },
  mint: { // Fresh mint with emerald.
    light: {
      primary: '#006647', onPrimary: '#FFFFFF', nav: '#CAF3E0', onNav: '#091D15', canvas: '#F4F8F6', surface: '#FFFFFF', line: '#DCE6E1', ink: '#091D15',
      muted: '#54695F', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#91DEBC', onPrimary: '#131A17', nav: '#0C281D', onNav: '#FFFFFF', canvas: '#131A17', surface: '#1B2420', line: '#303B36', ink: '#E7EDEA',
      muted: '#AAB8B1', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#131A17',
    },
  },
  apricot: { // Apricot with terracotta, like Nabeul pottery.
    light: {
      primary: '#9C4022', onPrimary: '#FFFFFF', nav: '#FDCDA0', onNav: '#23140A', canvas: '#FCF6F2', surface: '#FFFFFF', line: '#ECE0D9', ink: '#23140A',
      muted: '#715F53', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#F4AE95', onPrimary: '#1F1611', nav: '#321E16', onNav: '#FFFFFF', canvas: '#1F1611', surface: '#291F19', line: '#42352C', ink: '#F1EAE5',
      muted: '#C1B1A6', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#1F1611',
    },
  },
  paper: { // Clean white and black, minimal.
    light: {
      primary: '#131922', onPrimary: '#FFFFFF', nav: '#FDFDFD', onNav: '#131922', canvas: '#F2F3F6', surface: '#FFFFFF', line: '#E0E3E8', ink: '#131922',
      muted: '#5D646F', mutedFill: '#5F697E', ok: '#036639', info: '#0B66D6', warn: '#A96000', danger: '#B71824', on: '#FFFFFF',
    },
    dark: {
      primary: '#EDEEF1', onPrimary: '#16181C', nav: '#121417', onNav: '#FFFFFF', canvas: '#16181C', surface: '#1F2226', line: '#34383E', ink: '#E9EBEE',
      muted: '#B0B4BC', mutedFill: '#A2ABBE', ok: '#6FD395', info: '#70AFF4', warn: '#F5B75B', danger: '#F87D7C', on: '#16181C',
    },
  },
};

export type ThemeId = keyof typeof PALETTES;
export type Scheme = 'light'|'dark';
export type Palette = typeof PALETTES[ThemeId][Scheme];
export const DEFAULT_THEME: ThemeId = 'navy';

// The green of a progress bar (a free period under the dates asked for): brighter than the light
// scheme's `ok`, a dark green made for text. The same in every palette.
export const BAR_GREEN: Record<Scheme, string> = { light: '#1FA35C', dark: '#6FD395' };
export const isThemeId = (id: unknown): id is ThemeId => typeof id === 'string' && id in PALETTES;

// How the owner's picker groups them: a deep sidebar, a bold coloured one, a light one.
export const THEME_FAMILIES: Record<'deep'|'bold'|'light', ThemeId[]> = {
  deep: [ 'navy', 'plate', 'noir', 'racing', 'oxblood', 'electric' ],
  bold: [ 'rosso', 'papaya', 'taxi', 'gulf', 'sea', 'rose', 'desert' ],
  light: [ 'blossom', 'lilac', 'mint', 'apricot', 'paper' ],
};
