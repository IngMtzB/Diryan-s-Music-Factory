/**
 * frontend/src/constants/genres.js — Genre Synthesis Matrix definitions
 * matching example.html and Video Game Music specialized rules.
 */

export const GENRE_CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'regional', label: 'Regional & Tumbado' },
  { id: 'gaming', label: 'Gaming & Cinematic' },
  { id: 'cyberpunk', label: 'Cyberpunk & Synth' },
  { id: 'trap', label: 'Trap & Drill' },
  { id: 'lofi', label: 'Lo-Fi / Beats' },
];

export const GENRE_CARDS = [
  {
    id: 'corridos_belicos',
    category: 'regional',
    tag: 'Regional & Tumbado',
    title: 'Corridos Bélicos',
    description:
      'Tololoche percusivo, requinto de doce cuerdas metálico con 808s saturados y metales de banda en compás de 3/4.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBqmf9iuwQsR2MIdC3BpLrtZqxOhpmSaW0mVu8e2Rop9aUOnl7poNERi78MCgOcG7Gu2mxFa1R6f-dGWRLBErUJOIN4n6cY89CV40-G3dOQxYgF-o0xk-d_8EVa5RcnEHRsCOIIrgpxnAKA8jR5CleuqcN7tL8QakkLZDTJswJdL80AqKSM898mRuMVcw84OJYqVI1uHqSZBooSye_V_HP6Xe7bMg9E8bq5Gr26fho',
    tuning: 'Afinación: Fa# Menor',
    bpm: '145 BPM',
    presetName: 'REQUINTO_CYBERPUNK_V4',
    subgenres: [
      {
        id: 'electro_tumbado',
        label: 'Electro Tumbado',
        prompt:
          'Electro corrido tumbado, requinto de 12 cuerdas acústico con 808 distorsionado, charcheta de viento y sintetizador analógico a 145 BPM',
      },
      {
        id: 'tumbado_sinfonico',
        label: 'Tumbado Sinfónico',
        prompt:
          'Corrido tumbado sinfónico, requinto sierreño agresivo fusionado con cuerdas orquestales dramáticas, tololoche profundo y trombones bélicos a 138 BPM',
      },
      {
        id: 'cyber_corrido',
        label: 'Cyber-Corrido Belic',
        prompt:
          'Cyber-corrido bélico, requinto electro-acústico, bajo quinto agresivo, sub-bass 808 saturado, synth leads oscuros, 145 BPM',
      },
    ],
  },
  {
    id: 'musica_videojuegos',
    category: 'gaming',
    tag: 'Gaming Engine • Épico/Vocal',
    title: 'Música para Videojuegos (Épico & Combate)',
    description:
      'Texturas orquestales épicas, tambores taiko de combate, percusión ritual nórdica/eslava, voz como instrumento (glossolalia/latín) y arco dinámico AAA.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBFRsnOwC4foNQbhbuN7cfAIUdRvtgedL8ciN_pq3lPyaiFg9nbrBwjQA1w2fE297Bu56jBoW4Sn--ir8a6ZdgLpThL9NUms5CWddBxq_Y2G1-Ip3q7stXNt_-54-ZCwvNlFon6d2RtyfYPr-H_VtS2L6J-_u0ZL4IiwDKpBzzZvwpZ3xaHoO_QcWaEz6cU4tFyNOfXDLAZ1GYLWPziu2D0at6tkEy6fvlGwe_9mRo',
    tuning: 'Escala: Dórica / Frigia',
    bpm: '120 - 160 BPM',
    presetName: 'OST_DYNAMIC_ENGINE_V2',
    isVideogame: true,
    isAmbientOst: false,
    subgenres: [
      {
        id: 'slavic_dark_folk',
        label: 'Slavic Dark Folk & Combat',
        prompt:
          'Música para videojuegos - Slavic Dark Folk & Combat, hurdy-gurdy, ritual war drums, throat singing & female glossolalia vocalise, 140 BPM D Dorian, dark AAA combat vibe',
      },
      {
        id: 'dark_fantasy_emotivo',
        label: 'Dark Fantasy Emotivo / Tema Principal',
        prompt:
          'Música para videojuegos - Dark Fantasy Emotivo / Tema Principal, solo cello, harp, ethereal soprano vocalise in Latin & glossolalia, solemn choir, 118 BPM C# Minor, emotional AAA main theme',
      },
      {
        id: 'cyberpunk_boss_fight',
        label: 'Cyberpunk / Sci-Fi Boss Fight',
        prompt:
          'Música para videojuegos - Cyberpunk / Sci-Fi Boss Fight, distorted industrial synths, orchestral brass, operatic choir counterpoint, 155 BPM F Phrygian, high-intensity boss battle',
      },
    ],
  },
  {
    id: 'ost_ambiental_exploracion',
    category: 'gaming',
    tag: 'OST Ambiental • Sin Voces',
    title: 'OST Ambiental & Exploración (Sin Voces)',
    description:
      'Soundtrack instrumental de ambientación AAA para villas, bosques, menús tranquilos y dungeons. Cero voces: estructura cíclica con directivas [ ] y purely instrumental, no vocals.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBFRsnOwC4foNQbhbuN7cfAIUdRvtgedL8ciN_pq3lPyaiFg9nbrBwjQA1w2fE297Bu56jBoW4Sn--ir8a6ZdgLpThL9NUms5CWddBxq_Y2G1-Ip3q7stXNt_-54-ZCwvNlFon6d2RtyfYPr-H_VtS2L6J-_u0ZL4IiwDKpBzzZvwpZ3xaHoO_QcWaEz6cU4tFyNOfXDLAZ1GYLWPziu2D0at6tkEy6fvlGwe_9mRo',
    tuning: 'Escala: Dórica / Lidia / Mayor',
    bpm: '72 - 96 BPM',
    presetName: 'OST_AMBIENT_LOOP_V1',
    isVideogame: true,
    isAmbientOst: true,
    subgenres: [
      {
        id: 'medieval_village_forest',
        label: 'Villas & Bosques Tranquilos',
        prompt:
          'OST Ambiental & Exploración (Sin Voces) - Peaceful RPG Village & Forest, acoustic lute, wooden flute, soft pizzicato strings, purely instrumental, no vocals, 92 BPM G Major, warm nostalgic exploration atmosphere',
      },
      {
        id: 'mystic_dungeon_ruins',
        label: 'Dungeons & Ruinas Místicas',
        prompt:
          'OST Ambiental & Exploración (Sin Voces) - Ancient Mystic Dungeon & Ruins, celesta, solo cello, ambient pad drones, purely instrumental, no vocals, 76 BPM D Dorian, mysterious cavernous exploration atmosphere',
      },
      {
        id: 'peaceful_menu_sanctuary',
        label: 'Menús Tranquilos & Santuarios',
        prompt:
          'OST Ambiental & Exploración (Sin Voces) - Calm RPG Main Menu & Sanctuary, concert harp, soft felt piano, warm strings swell, purely instrumental, no vocals, 84 BPM E Minor, serene magical atmosphere',
      },
      {
        id: 'scifi_space_ambient',
        label: 'Exploración Espacial / Sci-Fi Ambient',
        prompt:
          'OST Ambiental & Exploración (Sin Voces) - Sci-Fi Space Exploration Ambient, analog modular synth pad, crystalline bell arpeggio, deep sub drone, purely instrumental, no vocals, 80 BPM C Lydian, vast cosmic exploration',
      },
    ],
  },
  {
    id: 'synthwave_darksynth',
    category: 'cyberpunk',
    tag: 'Analog Racks',
    title: 'Synthwave & Darksynth',
    description:
      'LinnDrum gated reverbs, bajos secuencias en sierra analógica, pads analógicos Roland Juno-106 con distorsión cinta.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuA1_7m4cb3eN-_q64O3AQpqTRVR7aR6yO9tXwXn470hoe1XqLmDCXh5uSeu-WmH15RI6Av7laLqU5rtWJBSX9WHFdpFrIJYLmWJ1qqJjU7vYKS8N-0uool1CbZJKndODZIWkrvMlEVxu9ZQs4T6NQ8rDYvzmvodWWCzbsgLVXa0G8TSGTVSUsMcuSNUgrefSdBnznvL7n78Pdg-uWgL8dVT64HGore1K5F92MjgiVg',
    tuning: 'Model: Oberheim OB-Xa',
    bpm: '118 BPM',
    presetName: 'DARKSYNTH_ARPEGGIO_84',
    subgenres: [
      {
        id: '80s_neon_drive',
        label: '80s Neon Drive',
        prompt:
          'Synthwave 80s Neon Drive, LinnDrum gated reverb snare, analog arpeggiated bassline, warm Juno-106 pads, nostalgic neon lead, 118 BPM',
      },
      {
        id: 'cyber_outrun',
        label: 'Cyber Outrun',
        prompt:
          'Darksynth Cyber Outrun, aggressive sawtooth bass, dystopian brass synths, punchy retro-futuristic drums, 130 BPM',
      },
      {
        id: 'heavy_industrial',
        label: 'Heavy Industrial',
        prompt:
          'Heavy Industrial Darksynth, distorted modular synths, metallic percussion, dark cyberpunk atmosphere, 136 BPM',
      },
    ],
  },
  {
    id: 'phonk_drift',
    category: 'trap',
    tag: 'Underground Bass',
    title: 'Phonk & Drift',
    description:
      'Cowbells distorsionados Roland TR-808, acapellas picadas de Memphis rap en cinta gastada y sub-bajos aplastados.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCdEtiPWr0CVMOZWv1IjyBNmg6jpD9u9KozVks_LRgRnThMYzGVD4HFxV0SRARILps4j4ycLdGrrfcQC3hEGzryerlPQgmHXo15uWE0mF9dDsdUWLQGYn2-33cxHUqhX2JHtq7zBlUkG6tUAR0ElQduOHG2cs73cN0BrvDp8Z9WvlqhzQRVACwX5vI3in4RZnjvFUUK0nyCt6tXIVG8hgh8sTomymh-KhrT4qLxV0I',
    tuning: 'Sidechain: Brutal',
    bpm: '150 BPM',
    presetName: 'DRIFT_COWBELL_808',
    subgenres: [
      {
        id: 'brazilian_funk_phonk',
        label: 'Brazilian Funk Phonk',
        prompt:
          'Brazilian Funk Phonk, distorted cowbell melody, heavy baile funk tamborzão percussion, crushed 808 sub bass, 150 BPM',
      },
      {
        id: 'memphis_drift',
        label: 'Memphis Drift',
        prompt:
          'Memphis Drift Phonk, TR-808 cowbells, lo-fi tape saturation, chopped dark vocal samples, aggressive drift bass, 148 BPM',
      },
      {
        id: 'cyber_phonk',
        label: 'Cyber Phonk',
        prompt:
          'Cyber Phonk, futuristic metallic cowbells, hard-hitting trap drums, dark reese bass and industrial textures, 155 BPM',
      },
    ],
  },
  {
    id: 'lofi_chillhop',
    category: 'lofi',
    tag: 'Late Night Tape',
    title: 'Lo-Fi & Coding Beats',
    description:
      'Pianos Rhodes cálidos con vinilo crepitante, baterías boom-bap relajadas y texturas ambientales nocturnas.',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBd9vhW2Td4s2ruxgNcFyOQwnzZ7PzGOL86YfaKsK50HzouOblBPKP5IFTbNEFVFZCdyHRvUtg1l_eBxxT6L3AY-O_WFM-tMuVtVtPlaqGe08h6dSjznp7psWJjmQMCnllQzI1kbwp2dEkQ1gGgJR-RJCWwGpuAsxEuAIa435hG9Y7nHpxNAzIApJMjk0pZwG3GYNfK5O14VD0-4UwdZ1tyLdsDm_Uj3OwO8KxfVeo',
    tuning: ' Escala: Maj7 / Min9',
    bpm: '82 BPM',
    presetName: 'LOFI_TAPE_WARMTH',
    subgenres: [
      {
        id: 'coding_night',
        label: 'Coding Night Beats',
        prompt:
          'Lo-Fi Coding Night Beats, warm Fender Rhodes chords, vinyl crackle, dusty boom-bap drums, deep mellow sub bass, 82 BPM',
      },
      {
        id: 'cyber_rain_lofi',
        label: 'Cyberpunk Rain Lo-Fi',
        prompt:
          'Cyberpunk Rain Lo-Fi, ambient synth pads, melancholic electric guitar, soft rain texture, chillhop beat, 78 BPM',
      },
    ],
  },
];

/**
 * Helper to match a style string back to a genre card + subgenre.
 */
export function findGenreFromStyle(styleStr = '') {
  const lower = (styleStr || '').toLowerCase();
  const findById = (id) => GENRE_CARDS.find((c) => c.id === id) || GENRE_CARDS[0];

  const isExplicitOst =
    lower.includes('ost ambiental') ||
    lower.includes('purely instrumental') ||
    lower.includes('no vocals') ||
    lower.includes('sin voces') ||
    lower.includes('videojuego');

  if (
    !isExplicitOst &&
    (lower.includes('corrido') ||
      lower.includes('tumbado') ||
      lower.includes('sierreño') ||
      lower.includes('sierreno') ||
      lower.includes('bélico') ||
      lower.includes('belico') ||
      lower.includes('requinto') ||
      lower.includes('tololoche'))
  ) {
    const card = findById('corridos_belicos');
    const sub =
      card.subgenres.find((s) => lower.includes(s.label.toLowerCase())) || card.subgenres[0];
    return { card, subgenre: sub };
  }

  if (lower.includes('synthwave') || lower.includes('darksynth') || lower.includes('outrun')) {
    const card = findById('synthwave_darksynth');
    return { card, subgenre: card.subgenres[0] };
  }
  if (lower.includes('phonk') || lower.includes('drift')) {
    const card = findById('phonk_drift');
    return { card, subgenre: card.subgenres[0] };
  }
  if (lower.includes('lo-fi') || lower.includes('lofi') || lower.includes('chillhop')) {
    const card = findById('lofi_chillhop');
    return { card, subgenre: card.subgenres[0] };
  }

  if (
    lower.includes('ost ambiental') ||
    lower.includes('purely instrumental') ||
    lower.includes('no vocals') ||
    lower.includes('sin voces') ||
    lower.includes('peaceful rpg') ||
    lower.includes('mystic dungeon') ||
    lower.includes('space exploration') ||
    lower.includes('exploración')
  ) {
    const card = findById('ost_ambiental_exploracion');
    const sub =
      card.subgenres.find((s) => lower.includes(s.label.toLowerCase().split(' ')[0])) ||
      card.subgenres[0];
    return { card, subgenre: sub };
  }

  if (
    lower.includes('videojuego') ||
    lower.includes('slavic') ||
    lower.includes('dark fantasy') ||
    lower.includes('boss fight') ||
    lower.includes('gaming') ||
    lower.includes('glossolalia')
  ) {
    const card = findById('musica_videojuegos');
    const sub =
      card.subgenres.find((s) => lower.includes(s.label.toLowerCase().split(' ')[0])) ||
      card.subgenres[0];
    return { card, subgenre: sub };
  }

  const card = findById('corridos_belicos');
  const sub =
    card.subgenres.find((s) => lower.includes(s.label.toLowerCase())) || card.subgenres[0];
  return { card, subgenre: sub };
}

function sanitizeNullishTitle(str = '', fallback = '') {
  let s = (str || '').trim();
  if (!s || ['null', 'none', 'undefined', 'n/a'].includes(s.toLowerCase())) {
    return fallback;
  }
  const stripped = s.replace(/^(?:null|none|undefined|n\/a)\s*(?:[-–—|:]\s*)+/i, '').trim();
  if (stripped !== s) {
    return fallback ? `${fallback} | ${stripped}` : stripped;
  }
  return s;
}

function sanitizeNullishTags(tagsStr = '') {
  if (!tagsStr) return '';
  return tagsStr
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && !['null', 'none', 'undefined', 'n/a'].includes(t.toLowerCase()))
    .join(', ');
}

/**
 * Parse Data.txt content into structured YouTube and TikTok fields for the Social Copy Engine cards.
 */
export function parseDataTxtFields(dataText = '', fallbackTitle = '', fallbackLyrics = '') {
  const cleanFallbackTitle =
    fallbackTitle && !['null', 'none', 'undefined'].includes(String(fallbackTitle).trim().toLowerCase())
      ? String(fallbackTitle).trim()
      : '';

  const result = {
    ytTitle: '',
    ytDesc: '',
    ytTags: '',
    ttCaption: '',
    ttHashtags: '',
  };

  if (!dataText) {
    result.ytTitle = cleanFallbackTitle ? `${cleanFallbackTitle} (Video Oficial)` : 'Sin título generado';
    result.ytDesc = fallbackLyrics || 'Genera las letras y metadatos para visualizar la descripción completa.';
    result.ytTags = 'corridos tumbados, ai music factory, suno ai, musica de la 403';
    result.ttCaption = cleanFallbackTitle || 'Nueva producción en AI Music Factory 🔥';
    result.ttHashtags = '#corridosenhtml #musicadela403 #AIMusicFactory';
    return result;
  }

  // Split into YouTube and TikTok blocks
  const tiktokSplit = dataText.split(/📱\s*TIKTOK/i);
  const ytPart = tiktokSplit[0] || '';
  const ttPart = tiktokSplit[1] || '';

  // Extract YouTube Title
  const ytTitleMatch = ytPart.match(/📌\s*Título:\s*\n([\s\S]*?)(?=\n\s*📝\s*Descripción:|\n═|$)/i);
  if (ytTitleMatch) {
    result.ytTitle = sanitizeNullishTitle(ytTitleMatch[1].trim(), cleanFallbackTitle);
  }

  // Extract YouTube Description
  const ytDescMatch = ytPart.match(/📝\s*Descripción:\s*\n([\s\S]*?)(?=\n\s*🏷️\s*Etiquetas|\n═|$)/i);
  if (ytDescMatch) {
    result.ytDesc = ytDescMatch[1].trim();
  }

  // Extract YouTube Tags
  const ytTagsMatch = ytPart.match(/🏷️\s*Etiquetas[^:\n]*:\s*\n([\s\S]*?)(?=\n═|$)/i);
  if (ytTagsMatch) {
    result.ytTags = sanitizeNullishTags(ytTagsMatch[1].trim());
  }

  // Extract TikTok Caption
  const ttCaptionMatch = ttPart.match(/📝\s*Descripción:\s*\n([\s\S]*?)(?=\n\s*🏷️\s*Hashtags:|\n═|$)/i);
  if (ttCaptionMatch) {
    result.ttCaption = sanitizeNullishTitle(ttCaptionMatch[1].trim(), cleanFallbackTitle);
  }

  // Extract TikTok Hashtags
  const ttHashMatch = ttPart.match(/🏷️\s*Hashtags:\s*\n([\s\S]*?)(?=\n═|$)/i);
  if (ttHashMatch) {
    result.ttHashtags = ttHashMatch[1].trim();
  }

  if (!result.ytTitle) result.ytTitle = cleanFallbackTitle || 'Título pendiente';
  if (!result.ytDesc) result.ytDesc = dataText;
  if (!result.ytTags) result.ytTags = 'corridos en html, musica de la 403, Diryan\'s Factory Music';
  if (!result.ttCaption) result.ttCaption = result.ytTitle;
  if (!result.ttHashtags) result.ttHashtags = '#corridosenhtml #musicadela403';

  return result;
}

