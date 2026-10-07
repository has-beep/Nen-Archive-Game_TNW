/**
 * Organisations and their rules.
 *
 * A rule here is not decoration: every `key` is read somewhere in the
 * simulation, either as a constraint on what members will choose to do or as
 * a trigger that punishes a member who breaks it (see sim/society/rules.ts).
 * The text is what the Organisation panel shows, worded after the series.
 */
import type { Rule } from '../sim/types'

export interface OrgDef {
  key: string
  name: string
  short: string
  kind: 'association' | 'gang' | 'family' | 'clan' | 'royal' | 'military' | 'mafia' | 'swarm' | 'arena' | 'company' | 'team' | 'bloc' | 'school' | 'cult'
  hq: string
  nation: string
  color: string
  ranks: string[]
  treasury: number
  rules: Rule[]
  seats?: number
  secret?: boolean
  dead?: boolean
  desc: string
}

export const HUNTER_BYLAWS: Rule[] = [
  { key: 'hunt_always', n: 'Article 1', text: 'Hunters must always be hunting something.', note: 'A Hunter who drifts without a goal for too long goes looking for one.' },
  { key: 'martial_minimum', n: 'Article 2', text: 'Hunters must have a minimal understanding of martial arts.', note: 'In practice, Nen. A new Hunter who cannot use it is quietly tested again, and goes looking for a teacher.' },
  { key: 'license_irrevocable', n: 'Article 3', text: 'Once obtained, a Hunter License cannot be revoked for any reason. Neither will it be reissued.', note: 'A stolen or sold licence is gone for good.' },
  { key: 'no_hunter_on_hunter', n: 'Article 4', text: 'Hunters shall not target other Hunters unless they commit heinous crimes.', note: 'A Hunter who attacks another without cause is blacklisted.' },
  { key: 'star_one', n: 'Article 5', text: 'One star is given to a Hunter who produces remarkable achievements in a particular field.' },
  { key: 'star_two', n: 'Article 6', text: 'A Single Star Hunter who holds an official position and has mentored a Hunter who earned a star is given two stars.' },
  { key: 'star_three', n: 'Article 7', text: 'A Double Star Hunter with remarkable achievements in multiple fields is given three stars.' },
  { key: 'chair_confidence', n: 'Article 8', text: 'The Chairman must hold the confidence of a majority of his colleagues.' },
  { key: 'chair_vacancy', n: 'Article 9', text: 'When the chair falls vacant, the vote for a successor is held at once. The Vice-Chairman holds deputy power meanwhile.', note: 'Every Hunter votes. Rounds continue until one candidate wins a majority of the votes cast.' },
  { key: 'chair_exam', n: 'Article 10', text: 'The Chairman decides how new members are selected.', note: 'The Exam is set by the chair and run by Hunters he appoints.' },
]

export const ORGS: OrgDef[] = [
  {
    key: 'ha', name: 'Hunter Association', short: 'Hunters', kind: 'association', hq: 'swardani', nation: 'mimbo', color: '#2e7d9a',
    ranks: ['Hunter', 'Zodiac', 'Vice-Chairman', 'Chairman'], treasury: 4000, rules: HUNTER_BYLAWS,
    desc: 'Licenses, regulates and dispatches Hunters, the people who chase what everyone else is afraid of. It sets the Hunter Exam each January.',
  },
  {
    key: 'troupe', name: 'Phantom Troupe', short: 'Troupe', kind: 'gang', hq: 'meteor', nation: 'none', color: '#5b3a8c', seats: 13,
    ranks: ['Leg', 'Head'], treasury: 300,
    rules: [
      { key: 'spider_first', n: 'Rule 1', text: 'The Spider\'s survival comes before any single member, the Head included.', note: 'If the Head is lost, the legs carry on. If the Head\'s order would destroy the Spider, it is not obeyed.' },
      { key: 'no_infighting', n: 'Rule 2', text: 'Members do not fight each other seriously. Disagreements are settled with a coin toss.' },
      { key: 'obey_head', n: 'Rule 3', text: 'Follow the Head\'s orders.' },
      { key: 'replace_by_kill', n: 'Rule 4', text: 'A dead member\'s number goes to whoever killed them, or to someone the Spider chooses.' },
      { key: 'avenge_leg', n: 'Custom', text: 'A leg that is cut off is paid for.', note: 'Not written down anywhere. Everyone knows it.' },
    ],
    desc: 'Thirteen thieves from Meteor City, each marked with a numbered spider. They steal what they want and kill whoever is in the way.',
  },
  {
    key: 'zoldyck', name: 'Zoldyck Family', short: 'Zoldycks', kind: 'family', hq: 'kukuroo', nation: 'padokea', color: '#7c8c9a',
    ranks: ['Butler', 'Senior Butler', 'Family', 'Head'], treasury: 9000,
    rules: [
      { key: 'paid_only', n: 'Family rule', text: 'We do not kill for free.', note: 'A Zoldyck kills on contract. Anyone else is left alone unless they get in the way.' },
      { key: 'never_unwinnable', n: 'Family rule', text: 'Never fight an opponent you cannot defeat.', note: 'Illumi drilled it into Killua: if you cannot win, run.' },
      { key: 'family_bond', n: 'Family rule', text: 'Family does not kill family.' },
      { key: 'contract_honour', n: 'Family rule', text: 'A job accepted is a job done, unless the client dies first.' },
      { key: 'nanika', n: 'Family secret', text: 'Whoever asks Nanika for a wish must grant its requests. Refuse three times in a row and the one who refused, and those they love, die.', note: 'Known only to a few. The family keeps Alluka locked away because of it.' },
    ],
    desc: 'The most famous family of assassins in the world. A contract on a Zoldyck target is, to most people, a death certificate.',
  },
  {
    key: 'mafia', name: 'Mafia Community', short: 'Mafia', kind: 'mafia', hq: 'yorknew', nation: 'saherta', color: '#a23b4a',
    ranks: ['Associate', 'Soldier', 'Boss', 'Don'], treasury: 8000,
    rules: [
      { key: 'ten_dons', n: 'Code', text: 'The Ten Dons decide. Their word is final.' },
      { key: 'omerta', n: 'Code', text: 'Nobody talks to outsiders about family business.' },
      { key: 'vendetta', n: 'Code', text: 'An attack on a family is answered by every family.' },
      { key: 'auction_sacred', n: 'Code', text: 'The Yorknew auction is protected ground. Whoever robs it is hunted by every family until they are dead.' },
    ],
    desc: 'The underworld federation behind Yorknew\'s auction, ruled by the Ten Dons and protected by the Shadow Beasts.',
  },
  {
    key: 'nostrade', name: 'Nostrade Family', short: 'Nostrade', kind: 'family', hq: 'yorknew', nation: 'saherta', color: '#c44569',
    ranks: ['Guard', 'Head guard', 'Boss'], treasury: 400,
    rules: [{ key: 'protect_neon', n: 'House rule', text: 'Neon\'s safety comes first. Her prophecies are the family\'s fortune.' }],
    desc: 'A mid-sized mafia family whose rise rests on the fortunes Neon Nostrade writes for the rich and powerful.',
  },
  {
    key: 'kakin_royal', name: 'Kakin Royal Family', short: 'Kakin Royals', kind: 'royal', hq: 'kakin', nation: 'kakin', color: '#e3be55',
    ranks: ['Royal Guard', 'Consort', 'Prince', 'King'], treasury: 30000,
    rules: [
      { key: 'succession_war', n: 'Royal law', text: 'When the King declares it, the princes compete for the throne. The last heir standing is King.', note: 'The contest begins on the voyage the King chooses. "Last standing" is not defined further, and some princes read it differently.' },
      { key: 'spirit_beasts', n: 'Royal law', text: 'A Guardian Spirit Beast may not kill another Spirit Beast, nor strike another prince directly.' },
      { key: 'ceremony_truce', n: 'Royal law', text: 'No blood is shed during the King\'s ceremonies.' },
      { key: 'royal_guards', n: 'Royal law', text: 'Every prince is guarded by the Royal Army, and may hire private guards besides.' },
    ],
    desc: 'King Nasubi Hui Guo Rou, his eight queens and fourteen children. The succession is decided the old way.',
  },
  {
    key: 'kakin_army', name: 'Kakin Royal Army', short: 'Royal Army', kind: 'military', hq: 'kakin', nation: 'kakin', color: '#b58a1b',
    ranks: ['Soldier', 'Officer', 'Commander', 'Deputy Commander-in-Chief'], treasury: 2000,
    rules: [
      { key: 'chain_of_command', n: 'Military law', text: 'Orders come down the chain of command and are obeyed.' },
      { key: 'academy_oath', n: 'Military law', text: 'Graduates of the Military Academy serve the First Prince.', note: 'Benjamin\'s ability inherits the Nen of his guards who die.' },
    ],
    desc: 'The army of the Kakin Empire. Its elite answer to First Prince Benjamin.',
  },
  {
    key: 'ants', name: 'Chimera Ants', short: 'Ants', kind: 'swarm', hq: 'ngl', nation: 'none', color: '#55883b', dead: true,
    ranks: ['Soldier', 'Squadron Leader', 'Royal Guard', 'King', 'Queen'], treasury: 0,
    rules: [
      { key: 'serve_king', n: 'Instinct', text: 'Everything serves the King.' },
      { key: 'feed_queen', n: 'Instinct', text: 'Prey is brought to the Queen, so she can give birth.' },
      { key: 'hierarchy', n: 'Instinct', text: 'Soldiers obey their squadron leader. Squadron leaders obey the Royal Guard.' },
    ],
    desc: 'An insect from the Dark Continent that takes the traits of whatever its queen eats. Fed on humans, its children are something new.',
  },
  {
    key: 'arena', name: 'Heavens Arena', short: 'Arena', kind: 'arena', hq: 'arena', nation: 'padokea', color: '#8c94aa',
    ranks: ['Fighter', '200th Floor Fighter', 'Floor Master'], treasury: 1500,
    rules: [
      { key: 'floors', n: 'Arena rule', text: 'Win to climb. Below the 200th floor, fights pay in cash. Above it, they pay in glory.' },
      { key: 'prep_90', n: 'Arena rule', text: 'A fighter who reaches the 200th floor has 90 days to register a fight, or loses the place.' },
      { key: 'four_losses', n: 'Arena rule', text: 'Four losses on the 200th floors and you are out.' },
      { key: 'floor_master', n: 'Arena rule', text: 'Ten wins earn a challenge for a Floor Master\'s floor.' },
    ],
    desc: 'A tower of 251 floors and four billion visitors a year. Everyone above the 200th floor uses Nen, whether they know it or not.',
  },
  {
    key: 'v5', name: 'The V5', short: 'V5', kind: 'bloc', hq: 'swardani', nation: 'mimbo', color: '#4a5a7a',
    ranks: ['Member state'], treasury: 0,
    rules: [
      { key: 'inviolability', n: 'Inviolability Treaty', text: 'No nation may travel to the Dark Continent.', note: 'Signed about two hundred years ago after every expedition ended in disaster.' },
      { key: 'rose_ban', n: 'Treaty', text: 'No nation may produce the Poor Man\'s Rose.', note: 'Production was banned. The existing stock was never destroyed.' },
      { key: 'calamity_pact', n: 'Treaty', text: 'A calamity brought back from the Dark Continent is every member\'s problem.' },
    ],
    desc: 'The five leading nations of the world: Kukan\'yu, Saherta, Ochima, Mimbo and Begerossé. Admitting a sixth would make it the V6.',
  },
  {
    key: 'mitene', name: 'Mitene Union', short: 'Mitene', kind: 'bloc', hq: 'wgorteau', nation: 'wgorteau', color: '#7d6e5b',
    ranks: ['Member state'], treasury: 0,
    rules: [{ key: 'mutual', n: 'Charter', text: 'Member states settle disputes among themselves without war.' }],
    desc: 'A loose union of small states on the Balsa Islands: East and West Gorteau, NGL and Rokario.',
  },
  {
    key: 'gi_masters', name: 'Greed Island Game Masters', short: 'Game Masters', kind: 'company', hq: 'greed', nation: 'none', color: '#7a4fd6',
    ranks: ['Game master', 'Creator'], treasury: 600,
    rules: [
      { key: 'gi_nen', n: 'Game rule', text: 'Only Nen users can enter the game.' },
      { key: 'gi_death', n: 'Game rule', text: 'Death in the game is death.' },
      { key: 'gi_clear', n: 'Game rule', text: 'Whoever collects all 100 Specified Slot cards clears the game and leaves with three cards.' },
    ],
    desc: 'Ging Freecss and his friends built Greed Island as a Nen game on a real island. A few of them still run it from inside.',
  },
  {
    key: 'bombers', name: 'The Bombers', short: 'Bombers', kind: 'gang', hq: 'greed', nation: 'none', color: '#5a4632', secret: true,
    ranks: ['Partner', 'Leader'], treasury: 20,
    rules: [{ key: 'countdown', n: 'Method', text: 'Touch the target, explain the bomb, and wait.' }],
    desc: 'Three players who decided the fastest way to clear Greed Island was to kill everyone else in it.',
  },
  {
    key: 'shingen', name: 'Shingen-ryu', short: 'Shingen-ryu', kind: 'school', hq: 'mimbo_hills', nation: 'mimbo', color: '#6b8f71',
    ranks: ['Student', 'Instructor', 'Master'], treasury: 30,
    rules: [{ key: 'teach_right', n: 'School rule', text: 'Nen is opened slowly and taught properly. Forcing it open is for emergencies.' }],
    desc: 'The kung fu school of Isaac Netero, Biscuit Krueger and Wing. Its students learn Nen the slow, safe way.',
  },
  {
    key: 'kurta', name: 'Kurta Clan', short: 'Kurta', kind: 'clan', hq: 'lukso', nation: 'kukanyu', color: '#b91c1c', dead: true,
    ranks: ['Member'], treasury: 0,
    rules: [{ key: 'scarlet', n: 'Clan law', text: 'Never let outsiders see the Scarlet Eyes.' }],
    desc: 'A clan whose eyes turned scarlet in strong emotion. The Phantom Troupe killed all 128 of them and took the eyes. One survived.',
  },
  {
    key: 'gorteau_regime', name: 'Gorteau Regime', short: 'Regime', kind: 'military', hq: 'peijin', nation: 'egorteau', color: '#8a2a35',
    ranks: ['Soldier', 'Officer', 'Minister', 'Supreme Leader'], treasury: 300,
    rules: [{ key: 'loyalty_or_death', n: 'State law', text: 'Disloyalty to the Supreme Leader is punished with death.' }],
    desc: 'The state machinery of East Gorteau, which keeps Ming Jol-ik in power.',
  },
  {
    key: 'zodiacs', name: 'The Zodiacs', short: 'Zodiacs', kind: 'team', hq: 'swardani', nation: 'mimbo', color: '#2b6f8a',
    ranks: ['Zodiac'], treasury: 50, seats: 12,
    rules: [{ key: 'zodiac_council', n: 'Charter', text: 'Twelve Hunters chosen by the Chairman advise him and run the Association\'s business.' }],
    desc: 'Netero\'s twelve advisers, each named for a sign of the zodiac.',
  },
]
