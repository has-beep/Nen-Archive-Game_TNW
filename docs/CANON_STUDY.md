# What the characters do, and why: canon as a design guide

Nen World does not script Hunter x Hunter. It models the reasons characters act, and lets them act. This file records the choices the series' characters make, the wants and rules behind them, and the mechanism in the engine that reproduces each one. If a run reaches a canon moment, it is because these pieces pushed it there; when it does not, the divergence still comes from the same reasons.

## The pattern behind the choices

Across the series, almost every turning point comes from one of these:

1. **A want that does not let go.** Gon looking for Ging. Kurapika and the Spider. Killua and freedom.
2. **A rule someone keeps at a cost.** Kurapika's chain vows. The Troupe's "the Spider comes first". The Zoldycks' "never fight what you cannot beat". The Hunter Bylaws.
3. **A bond.** Gon and Killua. Kurapika and Leorio. Killua and Alluka. Meruem and Komugi.
4. **Grief turned into a vow.** Gon against Pitou. Kurapika against the Troupe.
5. **Institutions with their own logic.** The Association's election. The Mafia's bounties. The V5's treaty. Kakin's succession.

The engine has one system for each: dreams, rules, relationships, vows and organisations.

## Characters

### Gon Freecss
- **Wants:** find Ging (`find` dream, priority 92); become a Hunter (because that is how you find a Hunter).
- **Canon choices:**
  - Leaves Whale Island at 12 for the Exam.
  - Befriends Killua at once.
  - Goes to Kukuroo Mountain to bring Killua back.
  - Learns Nen at Heavens Arena when the money runs out.
  - Clears Greed Island to reach Ging.
  - Gives everything to kill Pitou.
- **Engine:**
  - Exam candidates group by affinity, and children find children, so Gon and Killua bond.
  - The Ura Exam gives every new Hunter without Nen a `master` dream. That sends them to a teacher, or to Heavens Arena when broke.
  - Ging slips away (`elusive`) until Gon has cleared Greed Island; Accompany is redirected to someone Ging trusts.
  - `swearAllIn`: a loved one killed by someone far stronger, in an impulsive, vengeful prodigy, can trigger a vow that grows the body to its full potential and burns the user out afterwards.

### Killua Zoldyck
- **Wants:** to be free of his family; to protect Alluka; later, Gon's friendship above everything.
- **Rules imposed on him:**
  - Illumi's needle: run from any fight you might lose.
  - The Zoldyck rule: never fight what you cannot beat.
- **Canon choices:**
  - Walks out of the Exam final and kills a stranger (Bodoro) under the needle's influence.
  - Pulls the needle out to save Gon.
  - Takes Alluka away from the estate.
- **Engine:**
  - `illumiNeedle` flag: morale collapses against stronger foes, and there is a chance of the final-match kill, against someone he barely knows.
  - `free` and `protect` dreams.
  - Alluka is `confined` until someone frees her.
  - Godspeed is a destined Hatsu that needs charge.

### Kurapika
- **Wants:** destroy the Phantom Troupe (an org-wide vendetta); recover every pair of Scarlet Eyes.
- **Rules he binds himself with:**
  - Chain Jail works only on the Troupe, on pain of death.
  - Emperor Time costs lifespan.
- **Canon choices:**
  - Becomes a Nostrade bodyguard to reach the auction.
  - Captures Uvogin and kills him.
  - Binds Chrollo with the Judgment Chain.
  - Joins the Black Whale to reach Tserriednich's eyes.
- **Engine:**
  - `avenge` with `tag: 'org'`.
  - `recover` dream on `scarlet_eyes` items, which are scattered at worldgen; Tserriednich holds six.
  - `target_only` and `death_penalty` conditions.
  - Chain Jail captures (bind plus seal).
  - Judgment Chain leaves a lasting condition: no Nen, no contact with the Spider.

### Leorio Paradinight
- **Wants:** to be a doctor, because a friend died for lack of money for treatment.
- **Engine:** `doctor` dream; the healer level and treatment system. Doctors who come to disasters earn fame and purpose.

### Hisoka Morow
- **Wants:** a fight worth having (`chaos`); to beat Chrollo (`defeat`).
- **Rules:** leave unripe fruit to ripen; want the fight at its best, one on one, both at full strength.
- **Engine:**
  - `mercy` spares high-potential losers.
  - Duels rarely kill, and chaos winners often let a good opponent live.
  - The `defeat` dream waits for readiness and for the target to be alone, with a rematch cooldown.
  - The fake spider membership is secret.

### Chrollo Lucilfer and the Phantom Troupe
- **Rules:**
  - The Spider comes first, even before the Head.
  - Disputes are settled by coin toss.
  - A leg that dies is avenged.
  - A seat that empties is filled by someone strong and unattached.
- **Canon choices:** the Yorknew auction raid; the vendetta for Uvogin; Chrollo stealing abilities.
- **Engine:**
  - The Troupe's weekly ops (raids, the July Yorknew decision), `vendetta` ops, and seat recruitment.
  - Skill Hunter theft in fights.
  - The Mafia swears revenge after a raid and posts bounties.

### The Zoldyck family
- **Rules:** kill only on contract; never fight what you cannot beat; family before all.
- **Engine:**
  - Zoldycks never take board contracts; the family accepts them.
  - Mercy, except on the contract target.
  - Morale flight rule.
  - Household bonds (`familyTies`) so siblings never drift into "best friends".
  - Silva and Zeno, hired as a pair, can take Chrollo.

### Isaac Netero
- **Role:** Chairman. The Association's Article 9 holds an election the moment he dies.
- **Canon choice:** fights the King alone, loses, and detonates the Poor Man's Rose inside himself.
- **Engine:**
  - The strike team is the Chairman, the few he trusts and their students, plus Zeno hired to deliver him. The Zodiacs stay to run the Association.
  - The V5 give him the Rose; it goes off far from the palace.
  - The Guards are contaminated tending their King.
  - `electionTick` holds rounds every 14 days until there is a majority.

### Pariston Hill
- **Wants:** chaos, as a schemer: win, then throw it away.
- **Engine:** the `chaos` scheme option; an election winner with a chaos dream may accept and resign, naming a deputy (as he did with Cheadle).

### Ging Freecss
- **Wants:** to go where nobody has been (`explore`). He refuses to be found by his son until his son has earned it.
- **Engine:**
  - `elusive` at 0.97 until Greed Island is cleared.
  - Near-misses leave rumours that keep Gon moving.
  - Ging is among the likeliest people to organise an expedition to the Dark Continent.

### The Chimera Ant arc
- **Canon:**
  - A queen washes ashore and eats her way to a King.
  - The Royal Guard serve with total loyalty.
  - Squadron leaders who remember being human (Meleoron, Ikalgo, Koala) defect.
  - The King is softened by a blind Gungi player.
- **Engine:**
  - The queen arrives, gives birth to squadron leaders, then the Guard, then the King.
  - The ants hunt and turn the region into a hazard people flee.
  - The colony defends its Queen and King.
  - The Gungi relationship grows each day the King and Komugi share a place.
  - After the King dies, ants with human memory or empathy defect.

### Kakin and the Dark Continent
- **Canon:**
  - Kakin announces an expedition led by Beyond Netero.
  - The V5 admit Kakin rather than fight, becoming the V6.
  - The Succession War starts as the Black Whale sails.
  - Five past expeditions each brought back a hope and a calamity.
- **Engine:**
  - The V6 compromise, or war (25%).
  - Boarding, sailing, and princes hunting princes, each with a Guardian Spirit Beast.
  - Landing parties become expeditions on land.
  - Five canonical calamities and their hopes, plus calamities no one has recorded, rolled per world.
  - Expeditions can return with treasures, turn back, be caught by the V5, vanish, or carry a calamity home.

## Institutions

- **Hunter Association.**
  - Bylaws as rules: Art. 3, the licence is irrevocable; Art. 4, no Hunter-on-Hunter unless heinous; Arts. 5–7, star ranks; Art. 9, immediate election.
  - Blacklist bounties on the worst criminals, never on the Zoldycks.
  - Zodiac appointments by the Chairman.
  - The Ura Exam.
- **Hunter Exam.** Four phases with real examiners (Satotz, Menchi, Lippo in 1999). Candidates can die, and cruel candidates hunt the weak. The final is "until someone says I give up".
- **Heavens Arena.** Floors climbed by wins; the 200th floor's Nen welcome; ten wins for a Floor Master; four losses and you are out.
- **Mafia Community.** Ten Dons, the Nostrade family hiring bodyguards for the auction, bounties on anyone who robs them.
- **Greed Island.** Battera's selection; the last thirty cards need a team; the Bombers kill players with good hands; three cards out, including Accompany.
- **Nations.**
  - Each nation has a military with ordinary weapons and mass weapons (missiles, bio-weapons, the Poor Man's Rose).
  - Relations drift; incidents happen; wars are declared with allies.
  - Wars are fought on fronts.
  - Desperate nations use the Rose.

## Sacrifices and friendships the engine can produce

- **A vow staked on a fight is paid in full.** Lose and the user dies.
- **Grief changes people.** Mourning, anger and vengeance dreams; an org-wide vendetta when the killer belongs to something notorious.
- **Friendship is earned.** Bonds come from time together and from trust; best friends need years of trust, or something survived together.
- **Love.** Attraction, confession, marriage and children, which inherit traits. Royal and formal couples do not simply break up.
- **Someone who loves a dying person** may sail to the Dark Continent for the Herb for All Illnesses.

## Divergence is the point

Each of these mechanisms is a reason, not a script. In one world Killua kills a stranger in the Exam final; in another the needle fails. In one, Netero's team kills the King; in another, Hisoka gets to Netero first. The canon outcome is the most common one when the canon reasons are present, which is how a lore-accurate world can still surprise the people who know the story best.
