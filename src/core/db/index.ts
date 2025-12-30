export { db } from './db';
export type {
  Affix,
  AffixPattern,
  SocketableBonuses,
  Gem,
  GemType,
  GemQuality,
  EsrRune,
  LodRune,
  KanjiRune,
  Crystal,
  CrystalType,
  CrystalQuality,
  Runeword,
  Metadata,
} from './models';

// TXT data database and models
export { txtDb } from './txtDb';
export type {
  TxtProperty,
  TxtSocketableMod,
  TxtPropertyDef,
  TxtSocketable,
  TxtRuneRef,
  TxtRuneword,
  TxtUniqueItem,
  TxtPartialBonus,
  TxtSet,
  TxtSetItemBonus,
  TxtSetItem,
  TxtItemType,
  TxtItemTypeDef,
  TxtSkill,
  CharClassCode,
  TxtMetadata,
  TxtFilesData,
  ParsedTxtData,
} from './txtModels';
