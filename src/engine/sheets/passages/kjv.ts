/**
 * The same curated set, in the King James Version.
 *
 * ── Source ──────────────────────────────────────────────────────────────────
 *   Translation   King James (Authorized) Version, the standardised 1769 text.
 *   Publisher     eBible.org, from the Crosswire Bible Society
 *                 https://ebible.org/find/details.php?id=eng-kjv2006
 *   Release       eng-kjv2006, source files dated 16 May 2026
 *   Format        the verse-per-line release, `eng-kjv2006_vpl.txt`.
 *   Pulled        17 August 2026
 *   Licence       Public domain. The Crown's letters patent still bind
 *                 *printing in the United Kingdom*; outside it the text is
 *                 unambiguously free, which is why the WEBu is the default and
 *                 this is the option (docs/printables.md §12).
 *
 * ── The one thing that is not verbatim, and why ─────────────────────────────
 * Two marks in the release are printer's apparatus rather than words, and both
 * are removed here:
 *
 *   ¶      the pilcrow, which marks a paragraph in the 1769 typesetting. It
 *          survives into the verse-per-line text as a character at the head of
 *          about a fifth of the verses.
 *   [ ]    the brackets around words the translators supplied for English
 *          sense, which a printed KJV sets in italics. The *words* stay —
 *          "The LORD is my shepherd" is the verse — only the brackets go.
 *
 * A child copying "¶ Trust in the LORD" or "The LORD [is] my shepherd" is
 * copying the apparatus of a 1769 press, and neither mark survives into any
 * reader's edition. This is a change, so it is stated rather than quietly made:
 * `scripture.test.ts` compares every string below against
 * `release/eng-kjv2006.vpl.txt` with exactly these two removals applied and
 * nothing else, so the claim in this comment is the thing the build checks.
 *
 * The WEBu gets no such treatment — not because the marks aren't there (they
 * aren't) but because it could not: the trademark condition means a modified
 * World English Bible may not carry the name, and the KJV carries no such
 * condition.
 *
 * ── Why every entry, and not a subset ───────────────────────────────────────
 * Keyed by `ScriptureEntry.id`, with one string per verse in the same order.
 * A translation switch that silently fell back for half the library would be
 * worse than not offering one, so the suite asserts the key sets match exactly
 * and that each entry has the same number of verses as its WEBu counterpart.
 */

/** Verses by `ScriptureEntry.id`, in the same order as the WEBu entry's. */
export const KJV_VERSES: Record<string, readonly string[]> = {
  "in-the-beginning": [
    "In the beginning God created the heaven and the earth.",
  ],
  "the-first-day": [
    "In the beginning God created the heaven and the earth.",
    "And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
    "And God said, Let there be light: and there was light.",
    "And God saw the light, that it was good: and God divided the light from the darkness.",
    "And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.",
  ],
  "made-in-his-image": [
    "So God created man in his own image, in the image of God created he him; male and female created he them.",
  ],
  "the-seventh-day": [
    "Thus the heavens and the earth were finished, and all the host of them.",
    "And on the seventh day God ended his work which he had made; and he rested on the seventh day from all his work which he had made.",
    "And God blessed the seventh day, and sanctified it: because that in it he had rested from all his work which God created and made.",
  ],
  "seedtime-and-harvest": [
    "While the earth remaineth, seedtime and harvest, and cold and heat, and summer and winter, and day and night shall not cease.",
  ],
  "the-bow-in-the-cloud": [
    "I do set my bow in the cloud, and it shall be for a token of a covenant between me and the earth.",
  ],
  "i-am-with-you": [
    "And, behold, I am with thee, and will keep thee in all places whither thou goest, and will bring thee again into this land; for I will not leave thee, until I have done that which I have spoken to thee of.",
  ],
  "meant-it-for-good": [
    "But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive.",
  ],
  "the-lord-will-fight": [
    "The LORD shall fight for you, and ye shall hold your peace.",
  ],
  "my-strength-and-song": [
    "The LORD is my strength and song, and he is become my salvation: he is my God, and I will prepare him an habitation; my father’s God, and I will exalt him.",
  ],
  "the-ten-commandments": [
    "And God spake all these words, saying,",
    "I am the LORD thy God, which have brought thee out of the land of Egypt, out of the house of bondage.",
    "Thou shalt have no other gods before me.",
    "Thou shalt not make unto thee any graven image, or any likeness of any thing that is in heaven above, or that is in the earth beneath, or that is in the water under the earth:",
    "Thou shalt not bow down thyself to them, nor serve them: for I the LORD thy God am a jealous God, visiting the iniquity of the fathers upon the children unto the third and fourth generation of them that hate me;",
    "And shewing mercy unto thousands of them that love me, and keep my commandments.",
    "Thou shalt not take the name of the LORD thy God in vain; for the LORD will not hold him guiltless that taketh his name in vain.",
    "Remember the sabbath day, to keep it holy.",
    "Six days shalt thou labour, and do all thy work:",
    "But the seventh day is the sabbath of the LORD thy God: in it thou shalt not do any work, thou, nor thy son, nor thy daughter, thy manservant, nor thy maidservant, nor thy cattle, nor thy stranger that is within thy gates:",
    "For in six days the LORD made heaven and earth, the sea, and all that in them is, and rested the seventh day: wherefore the LORD blessed the sabbath day, and hallowed it.",
    "Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.",
    "Thou shalt not kill.",
    "Thou shalt not commit adultery.",
    "Thou shalt not steal.",
    "Thou shalt not bear false witness against thy neighbour.",
    "Thou shalt not covet thy neighbour’s house, thou shalt not covet thy neighbour’s wife, nor his manservant, nor his maidservant, nor his ox, nor his ass, nor any thing that is thy neighbour’s.",
  ],
  "honour-your-parents": [
    "Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.",
  ],
  "love-your-neighbour": [
    "Thou shalt not avenge, nor bear any grudge against the children of thy people, but thou shalt love thy neighbour as thyself: I am the LORD.",
  ],
  "the-blessing": [
    "The LORD bless thee, and keep thee:",
    "The LORD make his face shine upon thee, and be gracious unto thee:",
    "The LORD lift up his countenance upon thee, and give thee peace.",
  ],
  "hear-o-israel": [
    "Hear, O Israel: The LORD our God is one LORD:",
    "And thou shalt love the LORD thy God with all thine heart, and with all thy soul, and with all thy might.",
    "And these words, which I command thee this day, shall be in thine heart:",
    "And thou shalt teach them diligently unto thy children, and shalt talk of them when thou sittest in thine house, and when thou walkest by the way, and when thou liest down, and when thou risest up.",
    "And thou shalt bind them for a sign upon thine hand, and they shall be as frontlets between thine eyes.",
    "And thou shalt write them upon the posts of thy house, and on thy gates.",
  ],
  "be-strong-and-courageous": [
    "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.",
  ],
  "he-goes-before-you": [
    "And the LORD, he it is that doth go before thee; he will be with thee, he will not fail thee, neither forsake thee: fear not, neither be dismayed.",
  ],
  "choose-life": [
    "I call heaven and earth to record this day against you, that I have set before you life and death, blessing and cursing: therefore choose life, that both thou and thy seed may live:",
    "That thou mayest love the LORD thy God, and that thou mayest obey his voice, and that thou mayest cleave unto him: for he is thy life, and the length of thy days: that thou mayest dwell in the land which the LORD sware unto thy fathers, to Abraham, to Isaac, and to Jacob, to give them.",
  ],
  "this-book-of-the-law": [
    "This book of the law shall not depart out of thy mouth; but thou shalt meditate therein day and night, that thou mayest observe to do according to all that is written therein: for then thou shalt make thy way prosperous, and then thou shalt have good success.",
  ],
  "have-i-not-commanded-you": [
    "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.",
  ],
  "as-for-me-and-my-house": [
    "And if it seem evil unto you to serve the LORD, choose you this day whom ye will serve; whether the gods which your fathers served that were on the other side of the flood, or the gods of the Amorites, in whose land ye dwell: but as for me and my house, we will serve the LORD.",
  ],
  "where-you-go-i-will-go": [
    "And Ruth said, Intreat me not to leave thee, or to return from following after thee: for whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God:",
  ],
  "the-lord-looks-at-the-heart": [
    "But the LORD said unto Samuel, Look not on his countenance, or on the height of his stature; because I have refused him: for the Lord seeth not as man seeth; for man looketh on the outward appearance, but the LORD looketh on the heart.",
  ],
  "serve-him-in-truth": [
    "Only fear the LORD, and serve him in truth with all your heart: for consider how great things he hath done for you.",
  ],
  "give-thanks-for-he-is-good": [
    "O give thanks unto the LORD; for he is good; for his mercy endureth for ever.",
  ],
  "if-my-people": [
    "If my people, which are called by my name, shall humble themselves, and pray, and seek my face, and turn from their wicked ways; then will I hear from heaven, and will forgive their sin, and will heal their land.",
  ],
  "the-joy-of-the-lord": [
    "Then he said unto them, Go your way, eat the fat, and drink the sweet, and send portions unto them for whom nothing is prepared: for this day is holy unto our Lord: neither be ye sorry; for the joy of the LORD is your strength.",
  ],
  "for-such-a-time-as-this": [
    "For if thou altogether holdest thy peace at this time, then shall there enlargement and deliverance arise to the Jews from another place; but thou and thy father’s house shall be destroyed: and who knoweth whether thou art come to the kingdom for such a time as this?",
  ],
  "psalm-1": [
    "Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful.",
    "But his delight is in the law of the LORD; and in his law doth he meditate day and night.",
    "And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper.",
    "The ungodly are not so: but are like the chaff which the wind driveth away.",
    "Therefore the ungodly shall not stand in the judgment, nor sinners in the congregation of the righteous.",
    "For the LORD knoweth the way of the righteous: but the way of the ungodly shall perish.",
  ],
  "psalm-8": [
    "To the chief Musician upon Gittith, A Psalm of David. O LORD our Lord, how excellent is thy name in all the earth! who hast set thy glory above the heavens.",
    "Out of the mouth of babes and sucklings hast thou ordained strength because of thine enemies, that thou mightest still the enemy and the avenger.",
    "When I consider thy heavens, the work of thy fingers, the moon and the stars, which thou hast ordained;",
    "What is man, that thou art mindful of him? and the son of man, that thou visitest him?",
    "For thou hast made him a little lower than the angels, and hast crowned him with glory and honour.",
    "Thou madest him to have dominion over the works of thy hands; thou hast put all things under his feet:",
    "All sheep and oxen, yea, and the beasts of the field;",
    "The fowl of the air, and the fish of the sea, and whatsoever passeth through the paths of the seas.",
    "O LORD our Lord, how excellent is thy name in all the earth!",
  ],
  "the-heavens-declare": [
    "To the chief Musician, A Psalm of David. The heavens declare the glory of God; and the firmament sheweth his handywork.",
  ],
  "the-words-of-my-mouth": [
    "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight, O LORD, my strength, and my redeemer.",
  ],
  "psalm-23": [
    "A Psalm of David. The LORD is my shepherd; I shall not want.",
    "He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
    "He restoreth my soul: he leadeth me in the paths of righteousness for his name’s sake.",
    "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
    "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.",
    "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.",
  ],
  "the-earth-is-the-lords": [
    "A Psalm of David. The earth is the LORD’s, and the fulness thereof; the world, and they that dwell therein.",
  ],
  "show-me-your-ways": [
    "Shew me thy ways, O LORD; teach me thy paths.",
    "Lead me in thy truth, and teach me: for thou art the God of my salvation; on thee do I wait all the day.",
  ],
  "the-lord-is-my-light": [
    "A Psalm of David. The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?",
  ],
  "wait-for-the-lord": [
    "Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD.",
  ],
  "my-strength-and-shield": [
    "The LORD is my strength and my shield; my heart trusted in him, and I am helped: therefore my heart greatly rejoiceth; and with my song will I praise him.",
  ],
  "i-will-instruct-you": [
    "I will instruct thee and teach thee in the way which thou shalt go: I will guide thee with mine eye.",
  ],
  "taste-and-see": [
    "O taste and see that the LORD is good: blessed is the man that trusteth in him.",
  ],
  "keep-your-tongue": [
    "Keep thy tongue from evil, and thy lips from speaking guile.",
    "Depart from evil, and do good; seek peace, and pursue it.",
  ],
  "delight-in-the-lord": [
    "Delight thyself also in the LORD; and he shall give thee the desires of thine heart.",
  ],
  "as-the-deer": [
    "To the chief Musician, Maschil, for the sons of Korah. As the hart panteth after the water brooks, so panteth my soul after thee, O God.",
    "My soul thirsteth for God, for the living God: when shall I come and appear before God?",
  ],
  "a-very-present-help": [
    "To the chief Musician for the sons of Korah, A Song upon Alamoth. God is our refuge and strength, a very present help in trouble.",
  ],
  "be-still-and-know": [
    "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.",
  ],
  "create-in-me-a-clean-heart": [
    "Create in me a clean heart, O God; and renew a right spirit within me.",
  ],
  "cast-your-burden": [
    "Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.",
  ],
  "when-i-am-afraid": ["What time I am afraid, I will trust in thee."],
  "the-path-of-life": [
    "Thou wilt shew me the path of life: in thy presence is fulness of joy; at thy right hand there are pleasures for evermore.",
  ],
  "my-rock-and-my-fortress": [
    "The LORD is my rock, and my fortress, and my deliverer; my God, my strength, in whom I will trust; my buckler, and the horn of my salvation, and my high tower.",
  ],
  "teach-us-to-number-our-days": [
    "So teach us to number our days, that we may apply our hearts unto wisdom.",
  ],
  "the-secret-place": [
    "He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.",
    "I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust.",
  ],
  "come-let-us-sing": [
    "O come, let us sing unto the LORD: let us make a joyful noise to the rock of our salvation.",
    "Let us come before his presence with thanksgiving, and make a joyful noise unto him with psalms.",
    "For the LORD is a great God, and a great King above all gods.",
  ],
  "sing-a-new-song": [
    "O sing unto the LORD a new song: sing unto the LORD, all the earth.",
    "Sing unto the LORD, bless his name; shew forth his salvation from day to day.",
    "Declare his glory among the heathen, his wonders among all people.",
  ],
  "psalm-100": [
    "A Psalm of praise. Make a joyful noise unto the LORD, all ye lands.",
    "Serve the LORD with gladness: come before his presence with singing.",
    "Know ye that the LORD he is God: it is he that hath made us, and not we ourselves; we are his people, and the sheep of his pasture.",
    "Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.",
    "For the LORD is good; his mercy is everlasting; and his truth endureth to all generations.",
  ],
  "bless-the-lord-my-soul": [
    "A Psalm of David. Bless the LORD, O my soul: and all that is within me, bless his holy name.",
    "Bless the LORD, O my soul, and forget not all his benefits:",
    "Who forgiveth all thine iniquities; who healeth all thy diseases;",
    "Who redeemeth thy life from destruction; who crowneth thee with lovingkindness and tender mercies;",
    "Who satisfieth thy mouth with good things; so that thy youth is renewed like the eagle’s.",
  ],
  "give-thanks-to-the-lord": [
    "O give thanks unto the LORD, for he is good: for his mercy endureth for ever.",
  ],
  "the-fear-of-the-lord": [
    "The fear of the LORD is the beginning of wisdom: a good understanding have all they that do his commandments: his praise endureth for ever.",
  ],
  "i-love-the-lord": [
    "I love the LORD, because he hath heard my voice and my supplications.",
    "Because he hath inclined his ear unto me, therefore will I call upon him as long as I live.",
  ],
  "this-is-the-day": [
    "This is the day which the LORD hath made; we will rejoice and be glad in it.",
  ],
  "how-can-a-young-man": [
    "Wherewithal shall a young man cleanse his way? by taking heed thereto according to thy word.",
    "With my whole heart have I sought thee: O let me not wander from thy commandments.",
    "Thy word have I hid in mine heart, that I might not sin against thee.",
  ],
  "a-lamp-to-my-feet": [
    "Thy word is a lamp unto my feet, and a light unto my path.",
  ],
  "psalm-121": [
    "A Song of degrees. I will lift up mine eyes unto the hills, from whence cometh my help.",
    "My help cometh from the LORD, which made heaven and earth.",
    "He will not suffer thy foot to be moved: he that keepeth thee will not slumber.",
    "Behold, he that keepeth Israel shall neither slumber nor sleep.",
    "The LORD is thy keeper: the LORD is thy shade upon thy right hand.",
    "The sun shall not smite thee by day, nor the moon by night.",
    "The LORD shall preserve thee from all evil: he shall preserve thy soul.",
    "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.",
  ],
  "unless-the-lord-builds": [
    "A Song of degrees for Solomon. Except the LORD build the house, they labour in vain that build it: except the LORD keep the city, the watchman waketh but in vain.",
  ],
  "i-wait-for-the-lord": [
    "I wait for the LORD, my soul doth wait, and in his word do I hope.",
  ],
  "how-good-it-is": [
    "A Song of degrees of David. Behold, how good and how pleasant it is for brethren to dwell together in unity!",
  ],
  "his-loving-kindness-endures": [
    "O give thanks unto the LORD; for he is good: for his mercy endureth for ever.",
  ],
  "fearfully-and-wonderfully-made": [
    "For thou hast possessed my reins: thou hast covered me in my mother’s womb.",
    "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.",
  ],
  "search-me-god": [
    "Search me, O God, and know my heart: try me, and know my thoughts:",
    "And see if there be any wicked way in me, and lead me in the way everlasting.",
  ],
  "let-me-hear-in-the-morning": [
    "Cause me to hear thy lovingkindness in the morning; for in thee do I trust: cause me to know the way wherein I should walk; for I lift up my soul unto thee.",
  ],
  "gracious-and-merciful": [
    "The LORD is gracious, and full of compassion; slow to anger, and of great mercy.",
    "The LORD is good to all: and his tender mercies are over all his works.",
  ],
  "he-heals-the-broken-hearted": [
    "He healeth the broken in heart, and bindeth up their wounds.",
  ],
  "psalm-150": [
    "Praise ye the LORD. Praise God in his sanctuary: praise him in the firmament of his power.",
    "Praise him for his mighty acts: praise him according to his excellent greatness.",
    "Praise him with the sound of the trumpet: praise him with the psaltery and harp.",
    "Praise him with the timbrel and dance: praise him with stringed instruments and organs.",
    "Praise him upon the loud cymbals: praise him upon the high sounding cymbals.",
    "Let every thing that hath breath praise the LORD. Praise ye the LORD.",
  ],
  "the-lord-is-good-to-all": [
    "The LORD is good to all: and his tender mercies are over all his works.",
  ],
  "god-is-my-portion": [
    "My flesh and my heart faileth: but God is the strength of my heart, and my portion for ever.",
  ],
  "a-sun-and-a-shield": [
    "For the LORD God is a sun and shield: the LORD will give grace and glory: no good thing will he withhold from them that walk uprightly.",
  ],
  "merciful-and-gracious": [
    "But thou, O Lord, art a God full of compassion, and gracious, longsuffering, and plenteous in mercy and truth.",
  ],
  "the-beginning-of-knowledge": [
    "The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction.",
  ],
  "the-lord-gives-wisdom": [
    "For the LORD giveth wisdom: out of his mouth cometh knowledge and understanding.",
  ],
  "dont-forget-my-teaching": [
    "My son, forget not my law; but let thine heart keep my commandments:",
    "For length of days, and long life, and peace, shall they add to thee.",
  ],
  "trust-in-the-lord": [
    "Trust in the LORD with all thine heart; and lean not unto thine own understanding.",
    "In all thy ways acknowledge him, and he shall direct thy paths.",
  ],
  "honour-the-lord-with-your-substance": [
    "Honour the LORD with thy substance, and with the firstfruits of all thine increase:",
    "So shall thy barns be filled with plenty, and thy presses shall burst out with new wine.",
  ],
  "guard-your-heart": [
    "Keep thy heart with all diligence; for out of it are the issues of life.",
  ],
  "go-to-the-ant": [
    "Go to the ant, thou sluggard; consider her ways, and be wise:",
    "Which having no guide, overseer, or ruler,",
    "Provideth her meat in the summer, and gathereth her food in the harvest.",
  ],
  "wisdom-begins-with-fear": [
    "The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding.",
  ],
  "love-covers-all-wrongs": [
    "Hatred stirreth up strifes: but love covereth all sins.",
  ],
  "with-humility-comes-wisdom": [
    "When pride cometh, then cometh shame: but with the lowly is wisdom.",
  ],
  "lying-lips": [
    "Lying lips are abomination to the LORD: but they that deal truly are his delight.",
  ],
  "he-who-guards-his-mouth": [
    "He that keepeth his mouth keepeth his life: but he that openeth wide his lips shall have destruction.",
  ],
  "gathers-by-hand": [
    "Wealth gotten by vanity shall be diminished: but he that gathereth by labour shall increase.",
  ],
  "walk-with-the-wise": [
    "He that walketh with wise men shall be wise: but a companion of fools shall be destroyed.",
  ],
  "slow-to-anger": [
    "He that is slow to wrath is of great understanding: but he that is hasty of spirit exalteth folly.",
  ],
  "a-gentle-answer": [
    "A soft answer turneth away wrath: but grievous words stir up anger.",
  ],
  "a-glad-heart": [
    "A merry heart maketh a cheerful countenance: but by sorrow of the heart the spirit is broken.",
  ],
  "commit-your-works": [
    "Commit thy works unto the LORD, and thy thoughts shall be established.",
  ],
  "a-man-plans-his-way": [
    "A man’s heart deviseth his way: but the LORD directeth his steps.",
  ],
  "pride-goes-before-destruction": [
    "Pride goeth before destruction, and an haughty spirit before a fall.",
  ],
  "pleasant-words": [
    "Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.",
  ],
  "a-friend-loves-at-all-times": [
    "A friend loveth at all times, and a brother is born for adversity.",
  ],
  "a-cheerful-heart": [
    "A merry heart doeth good like a medicine: but a broken spirit drieth the bones.",
  ],
  "a-strong-tower": [
    "The name of the LORD is a strong tower: the righteous runneth into it, and is safe.",
  ],
  "a-friend-who-sticks-closer": [
    "A man that hath friends must shew himself friendly: and there is a friend that sticketh closer than a brother.",
  ],
  "listen-to-counsel": [
    "Hear counsel, and receive instruction, that thou mayest be wise in thy latter end.",
  ],
  "many-plans-in-a-mans-heart": [
    "There are many devices in a man’s heart; nevertheless the counsel of the LORD, that shall stand.",
  ],
  "even-a-child-is-known": [
    "Even a child is known by his doings, whether his work be pure, and whether it be right.",
  ],
  "the-plans-of-the-diligent": [
    "The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.",
  ],
  "a-good-name": [
    "A good name is rather to be chosen than great riches, and loving favour rather than silver and gold.",
  ],
  "train-up-a-child": [
    "Train up a child in the way he should go: and when he is old, he will not depart from it.",
  ],
  "a-righteous-man-rises-again": [
    "For a just man falleth seven times, and riseth up again: but the wicked shall fall into mischief.",
  ],
  "a-word-fitly-spoken": [
    "A word fitly spoken is like apples of gold in pictures of silver.",
  ],
  "dont-boast-about-tomorrow": [
    "Boast not thyself of to morrow; for thou knowest not what a day may bring forth.",
  ],
  "iron-sharpens-iron": [
    "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
  ],
  "he-who-conceals-his-sins": [
    "He that covereth his sins shall not prosper: but whoso confesseth and forsaketh them shall have mercy.",
  ],
  "a-fool-vents-his-anger": [
    "A fool uttereth all his mind: but a wise man keepeth it in till afterwards.",
  ],
  "every-word-of-god": [
    "Every word of God is pure: he is a shield unto them that put their trust in him.",
  ],
  "strength-and-dignity": [
    "Strength and honour are her clothing; and she shall rejoice in time to come.",
    "She openeth her mouth with wisdom; and in her tongue is the law of kindness.",
  ],
  "a-woman-who-fears-the-lord": [
    "Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.",
  ],
  "a-time-for-everything": [
    "To every thing there is a season, and a time to every purpose under the heaven:",
    "A time to be born, and a time to die; a time to plant, and a time to pluck up that which is planted;",
    "A time to kill, and a time to heal; a time to break down, and a time to build up;",
    "A time to weep, and a time to laugh; a time to mourn, and a time to dance;",
    "A time to cast away stones, and a time to gather stones together; a time to embrace, and a time to refrain from embracing;",
    "A time to get, and a time to lose; a time to keep, and a time to cast away;",
    "A time to rend, and a time to sew; a time to keep silence, and a time to speak;",
    "A time to love, and a time to hate; a time of war, and a time of peace.",
  ],
  "two-are-better-than-one": [
    "Two are better than one; because they have a good reward for their labour.",
    "For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up.",
  ],
  "the-end-of-the-matter": [
    "Let us hear the conclusion of the whole matter: Fear God, and keep his commandments: for this is the whole duty of man.",
  ],
  "i-know-my-redeemer-lives": [
    "For I know that my redeemer liveth, and that he shall stand at the latter day upon the earth:",
  ],
  "though-your-sins-be-scarlet": [
    "Come now, and let us reason together, saith the LORD: though your sins be as scarlet, they shall be as white as snow; though they be red like crimson, they shall be as wool.",
  ],
  "here-am-i-send-me": [
    "Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me.",
  ],
  "a-virgin-shall-conceive": [
    "Therefore the Lord himself shall give you a sign; Behold, a virgin shall conceive, and bear a son, and shall call his name Immanuel.",
  ],
  "for-to-us-a-child-is-born": [
    "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.",
  ],
  "perfect-peace": [
    "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.",
  ],
  "this-is-the-way": [
    "And thine ears shall hear a word behind thee, saying, This is the way, walk ye in it, when ye turn to the right hand, and when ye turn to the left.",
  ],
  "the-word-stands-forever": [
    "The grass withereth, the flower fadeth: but the word of our God shall stand for ever.",
  ],
  "they-shall-mount-up": [
    "Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding.",
    "He giveth power to the faint; and to them that have no might he increaseth strength.",
    "Even the youths shall faint and be weary, and the young men shall utterly fall:",
    "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.",
  ],
  "dont-be-afraid": [
    "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.",
  ],
  "i-have-called-you-by-name": [
    "But now thus saith the LORD that created thee, O Jacob, and he that formed thee, O Israel, Fear not: for I have redeemed thee, I have called thee by thy name; thou art mine.",
    "When thou passest through the waters, I will be with thee; and through the rivers, they shall not overflow thee: when thou walkest through the fire, thou shalt not be burned; neither shall the flame kindle upon thee.",
  ],
  "he-was-pierced": [
    "Surely he hath borne our griefs, and carried our sorrows: yet we did esteem him stricken, smitten of God, and afflicted.",
    "But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed.",
    "All we like sheep have gone astray; we have turned every one to his own way; and the LORD hath laid on him the iniquity of us all.",
  ],
  "my-thoughts-are-not-your-thoughts": [
    "For my thoughts are not your thoughts, neither are your ways my ways, saith the LORD.",
    "For as the heavens are higher than the earth, so are my ways higher than your ways, and my thoughts than your thoughts.",
  ],
  "my-word-will-not-return-empty": [
    "So shall my word be that goeth forth out of my mouth: it shall not return unto me void, but it shall accomplish that which I please, and it shall prosper in the thing whereto I sent it.",
  ],
  "a-watered-garden": [
    "And the LORD shall guide thee continually, and satisfy thy soul in drought, and make fat thy bones: and thou shalt be like a watered garden, and like a spring of water, whose waters fail not.",
  ],
  "before-i-formed-you": [
    "Before I formed thee in the belly I knew thee; and before thou camest forth out of the womb I sanctified thee, and I ordained thee a prophet unto the nations.",
  ],
  "a-tree-planted-by-the-waters": [
    "Blessed is the man that trusteth in the LORD, and whose hope the LORD is.",
    "For he shall be as a tree planted by the waters, and that spreadeth out her roots by the river, and shall not see when heat cometh, but her leaf shall be green; and shall not be careful in the year of drought, neither shall cease from yielding fruit.",
  ],
  "plans-to-give-you-hope": [
    "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.",
  ],
  "an-everlasting-love": [
    "The LORD hath appeared of old unto me, saying, Yea, I have loved thee with an everlasting love: therefore with lovingkindness have I drawn thee.",
  ],
  "call-to-me": [
    "Call unto me, and I will answer thee, and shew thee great and mighty things, which thou knowest not.",
  ],
  "new-every-morning": [
    "It is of the LORD’s mercies that we are not consumed, because his compassions fail not.",
    "They are new every morning: great is thy faithfulness.",
  ],
  "a-new-heart": [
    "A new heart also will I give you, and a new spirit will I put within you: and I will take away the stony heart out of your flesh, and I will give you an heart of flesh.",
  ],
  "our-god-is-able": [
    "If it be so, our God whom we serve is able to deliver us from the burning fiery furnace, and he will deliver us out of thine hand, O king.",
    "But if not, be it known unto thee, O king, that we will not serve thy gods, nor worship the golden image which thou hast set up.",
  ],
  "daniel-prayed": [
    "Now when Daniel knew that the writing was signed, he went into his house; and his windows being open in his chamber toward Jerusalem, he kneeled upon his knees three times a day, and prayed, and gave thanks before his God, as he did aforetime.",
  ],
  "let-justice-roll-down": [
    "But let judgment run down as waters, and righteousness as a mighty stream.",
  ],
  "salvation-belongs-to-the-lord": [
    "But I will sacrifice unto thee with the voice of thanksgiving; I will pay that that I have vowed. Salvation is of the LORD.",
  ],
  "what-does-the-lord-require": [
    "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?",
  ],
  "i-will-look-to-the-lord": [
    "Therefore I will look unto the LORD; I will wait for the God of my salvation: my God will hear me.",
  ],
  "yet-i-will-rejoice": [
    "Although the fig tree shall not blossom, neither shall fruit be in the vines; the labour of the olive shall fail, and the fields shall yield no meat; the flock shall be cut off from the fold, and there shall be no herd in the stalls:",
    "Yet I will rejoice in the LORD, I will joy in the God of my salvation.",
  ],
  "he-will-rejoice-over-you": [
    "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.",
  ],
  "not-by-might": [
    "Then he answered and spake unto me, saying, This is the word of the LORD unto Zerubbabel, saying, Not by might, nor by power, but by my spirit, saith the LORD of hosts.",
  ],
  "the-day-of-small-things": [
    "For who hath despised the day of small things? for they shall rejoice, and shall see the plummet in the hand of Zerubbabel with those seven; they are the eyes of the LORD, which run to and fro through the whole earth.",
  ],
  "i-the-lord-dont-change": [
    "For I am the LORD, I change not; therefore ye sons of Jacob are not consumed.",
  ],
  "not-by-bread-alone": [
    "But he answered and said, It is written, Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.",
  ],
  "the-beatitudes": [
    "Blessed are the poor in spirit: for theirs is the kingdom of heaven.",
    "Blessed are they that mourn: for they shall be comforted.",
    "Blessed are the meek: for they shall inherit the earth.",
    "Blessed are they which do hunger and thirst after righteousness: for they shall be filled.",
    "Blessed are the merciful: for they shall obtain mercy.",
    "Blessed are the pure in heart: for they shall see God.",
    "Blessed are the peacemakers: for they shall be called the children of God.",
    "Blessed are they which are persecuted for righteousness’ sake: for theirs is the kingdom of heaven.",
    "Blessed are ye, when men shall revile you, and persecute you, and shall say all manner of evil against you falsely, for my sake.",
    "Rejoice, and be exceeding glad: for great is your reward in heaven: for so persecuted they the prophets which were before you.",
  ],
  "salt-and-light": [
    "Ye are the salt of the earth: but if the salt have lost his savour, wherewith shall it be salted? it is thenceforth good for nothing, but to be cast out, and to be trodden under foot of men.",
    "Ye are the light of the world. A city that is set on an hill cannot be hid.",
    "Neither do men light a candle, and put it under a bushel, but on a candlestick; and it giveth light unto all that are in the house.",
    "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.",
  ],
  "let-your-light-shine": [
    "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.",
  ],
  "the-lords-prayer": [
    "After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name.",
    "Thy kingdom come. Thy will be done in earth, as it is in heaven.",
    "Give us this day our daily bread.",
    "And forgive us our debts, as we forgive our debtors.",
    "And lead us not into temptation, but deliver us from evil: For thine is the kingdom, and the power, and the glory, for ever. Amen.",
  ],
  "treasure-in-heaven": [
    "Lay not up for yourselves treasures upon earth, where moth and rust doth corrupt, and where thieves break through and steal:",
    "But lay up for yourselves treasures in heaven, where neither moth nor rust doth corrupt, and where thieves do not break through nor steal:",
    "For where your treasure is, there will your heart be also.",
  ],
  "look-at-the-birds": [
    "Therefore I say unto you, Take no thought for your life, what ye shall eat, or what ye shall drink; nor yet for your body, what ye shall put on. Is not the life more than meat, and the body than raiment?",
    "Behold the fowls of the air: for they sow not, neither do they reap, nor gather into barns; yet your heavenly Father feedeth them. Are ye not much better than they?",
    "Which of you by taking thought can add one cubit unto his stature?",
  ],
  "seek-first-the-kingdom": [
    "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
  ],
  "ask-and-it-will-be-given": [
    "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you:",
    "For every one that asketh receiveth; and he that seeketh findeth; and to him that knocketh it shall be opened.",
  ],
  "the-golden-rule": [
    "Therefore all things whatsoever ye would that men should do to you, do ye even so to them: for this is the law and the prophets.",
  ],
  "the-house-on-the-rock": [
    "Therefore whosoever heareth these sayings of mine, and doeth them, I will liken him unto a wise man, which built his house upon a rock:",
    "And the rain descended, and the floods came, and the winds blew, and beat upon that house; and it fell not: for it was founded upon a rock.",
    "And every one that heareth these sayings of mine, and doeth them not, shall be likened unto a foolish man, which built his house upon the sand:",
    "And the rain descended, and the floods came, and the winds blew, and beat upon that house; and it fell: and great was the fall of it.",
  ],
  "come-to-me": [
    "Come unto me, all ye that labour and are heavy laden, and I will give you rest.",
    "Take my yoke upon you, and learn of me; for I am meek and lowly in heart: and ye shall find rest unto your souls.",
    "For my yoke is easy, and my burden is light.",
  ],
  "where-two-or-three": [
    "For where two or three are gathered together in my name, there am I in the midst of them.",
  ],
  "let-the-children-come": [
    "But Jesus said, Suffer little children, and forbid them not, to come unto me: for of such is the kingdom of heaven.",
  ],
  "with-god-all-things-are-possible": [
    "But Jesus beheld them, and said unto them, With men this is impossible; but with God all things are possible.",
  ],
  "the-greatest-commandment": [
    "Jesus said unto him, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind.",
    "This is the first and great commandment.",
    "And the second is like unto it, Thou shalt love thy neighbour as thyself.",
    "On these two commandments hang all the law and the prophets.",
  ],
  "the-least-of-these": [
    "And the King shall answer and say unto them, Verily I say unto you, Inasmuch as ye have done it unto one of the least of these my brethren, ye have done it unto me.",
  ],
  "the-empty-tomb": [
    "In the end of the sabbath, as it began to dawn toward the first day of the week, came Mary Magdalene and the other Mary to see the sepulchre.",
    "And, behold, there was a great earthquake: for the angel of the Lord descended from heaven, and came and rolled back the stone from the door, and sat upon it.",
    "His countenance was like lightning, and his raiment white as snow:",
    "And for fear of him the keepers did shake, and became as dead men.",
    "And the angel answered and said unto the women, Fear not ye: for I know that ye seek Jesus, which was crucified.",
    "He is not here: for he is risen, as he said. Come, see the place where the Lord lay.",
    "And go quickly, and tell his disciples that he is risen from the dead; and, behold, he goeth before you into Galilee; there shall ye see him: lo, I have told you.",
    "And they departed quickly from the sepulchre with fear and great joy; and did run to bring his disciples word.",
    "And as they went to tell his disciples, behold, Jesus met them, saying, All hail. And they came and held him by the feet, and worshipped him.",
    "Then said Jesus unto them, Be not afraid: go tell my brethren that they go into Galilee, and there shall they see me.",
  ],
  "the-great-commission": [
    "And Jesus came and spake unto them, saying, All power is given unto me in heaven and in earth.",
    "Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost:",
    "Teaching them to observe all things whatsoever I have commanded you: and, lo, I am with you alway, even unto the end of the world. Amen.",
  ],
  "not-to-be-served": [
    "For even the Son of man came not to be ministered unto, but to minister, and to give his life a ransom for many.",
  ],
  "believe-that-you-have-received": [
    "Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.",
  ],
  "love-god-love-your-neighbour": [
    "And thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy mind, and with all thy strength: this is the first commandment.",
    "And the second is like, namely this, Thou shalt love thy neighbour as thyself. There is none other commandment greater than these.",
  ],
  "go-into-all-the-world": [
    "And he said unto them, Go ye into all the world, and preach the gospel to every creature.",
  ],
  "nothing-is-impossible": ["For with God nothing shall be impossible."],
  "the-christmas-story": [
    "And it came to pass in those days, that there went out a decree from Cæsar Augustus, that all the world should be taxed.",
    "(And this taxing was first made when Cyrenius was governor of Syria.)",
    "And all went to be taxed, every one into his own city.",
    "And Joseph also went up from Galilee, out of the city of Nazareth, into Judæa, unto the city of David, which is called Bethlehem; (because he was of the house and lineage of David:)",
    "To be taxed with Mary his espoused wife, being great with child.",
    "And so it was, that, while they were there, the days were accomplished that she should be delivered.",
    "And she brought forth her firstborn son, and wrapped him in swaddling clothes, and laid him in a manger; because there was no room for them in the inn.",
    "And there were in the same country shepherds abiding in the field, keeping watch over their flock by night.",
    "And, lo, the angel of the Lord came upon them, and the glory of the Lord shone round about them: and they were sore afraid.",
    "And the angel said unto them, Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people.",
    "For unto you is born this day in the city of David a Saviour, which is Christ the Lord.",
    "And this shall be a sign unto you; Ye shall find the babe wrapped in swaddling clothes, lying in a manger.",
    "And suddenly there was with the angel a multitude of the heavenly host praising God, and saying,",
    "Glory to God in the highest, and on earth peace, good will toward men.",
    "And it came to pass, as the angels were gone away from them into heaven, the shepherds said one to another, Let us now go even unto Bethlehem, and see this thing which is come to pass, which the Lord hath made known unto us.",
    "And they came with haste, and found Mary, and Joseph, and the babe lying in a manger.",
    "And when they had seen it, they made known abroad the saying which was told them concerning this child.",
    "And all they that heard it wondered at those things which were told them by the shepherds.",
    "But Mary kept all these things, and pondered them in her heart.",
    "And the shepherds returned, glorifying and praising God for all the things that they had heard and seen, as it was told unto them.",
  ],
  "jesus-grew": [
    "And Jesus increased in wisdom and stature, and in favour with God and man.",
  ],
  "do-to-others": [
    "And as ye would that men should do to you, do ye also to them likewise.",
  ],
  "give-and-it-will-be-given": [
    "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again.",
  ],
  "love-the-lord-your-god": [
    "And he answering said, Thou shalt love the Lord thy God with all thy heart, and with all thy soul, and with all thy strength, and with all thy mind; and thy neighbour as thyself.",
  ],
  "ask-seek-knock": [
    "And I say unto you, Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.",
    "For every one that asketh receiveth; and he that seeketh findeth; and to him that knocketh it shall be opened.",
  ],
  "to-seek-and-to-save": [
    "For the Son of man is come to seek and to save that which was lost.",
  ],
  "he-is-not-here": [
    "Now upon the first day of the week, very early in the morning, they came unto the sepulchre, bringing the spices which they had prepared, and certain others with them.",
    "And they found the stone rolled away from the sepulchre.",
    "And they entered in, and found not the body of the Lord Jesus.",
    "And it came to pass, as they were much perplexed thereabout, behold, two men stood by them in shining garments:",
    "And as they were afraid, and bowed down their faces to the earth, they said unto them, Why seek ye the living among the dead?",
    "He is not here, but is risen: remember how he spake unto you when he was yet in Galilee,",
    "Saying, The Son of man must be delivered into the hands of sinful men, and be crucified, and the third day rise again.",
    "And they remembered his words,",
    "And returned from the sepulchre, and told all these things unto the eleven, and to all the rest.",
  ],
  "in-the-beginning-was-the-word": [
    "In the beginning was the Word, and the Word was with God, and the Word was God.",
    "The same was in the beginning with God.",
    "All things were made by him; and without him was not any thing made that was made.",
    "In him was life; and the life was the light of men.",
    "And the light shineth in darkness; and the darkness comprehended it not.",
  ],
  "children-of-god": [
    "But as many as received him, to them gave he power to become the sons of God, even to them that believe on his name:",
  ],
  "the-word-became-flesh": [
    "And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth.",
  ],
  "for-god-so-loved-the-world": [
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  ],
  "not-to-condemn": [
    "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
  ],
  "the-light-of-the-world": [
    "Then spake Jesus again unto them, saying, I am the light of the world: he that followeth me shall not walk in darkness, but shall have the light of life.",
  ],
  "life-abundantly": [
    "The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly.",
  ],
  "the-good-shepherd": [
    "I am the good shepherd: the good shepherd giveth his life for the sheep.",
  ],
  "the-resurrection-and-the-life": [
    "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:",
    "And whosoever liveth and believeth in me shall never die. Believest thou this?",
  ],
  "a-new-commandment": [
    "A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another.",
    "By this shall all men know that ye are my disciples, if ye have love one to another.",
  ],
  "dont-let-your-heart-be-troubled": [
    "Let not your heart be troubled: ye believe in God, believe also in me.",
    "In my Father’s house are many mansions: if it were not so, I would have told you. I go to prepare a place for you.",
    "And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also.",
  ],
  "the-way-the-truth-the-life": [
    "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.",
  ],
  "my-peace-i-give": [
    "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.",
  ],
  "the-vine-and-the-branches": [
    "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.",
  ],
  "greater-love-has-no-one": [
    "This is my commandment, That ye love one another, as I have loved you.",
    "Greater love hath no man than this, that a man lay down his life for his friends.",
  ],
  "i-have-overcome-the-world": [
    "These things I have spoken unto you, that in me ye might have peace. In the world ye shall have tribulation: but be of good cheer; I have overcome the world.",
  ],
  "you-will-be-my-witnesses": [
    "But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me both in Jerusalem, and in all Judæa, and in Samaria, and unto the uttermost part of the earth.",
  ],
  "no-other-name": [
    "Neither is there salvation in any other: for there is none other name under heaven given among men, whereby we must be saved.",
  ],
  "believe-and-be-saved": [
    "And they said, Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house.",
  ],
  "more-blessed-to-give": [
    "I have shewed you all things, how that so labouring ye ought to support the weak, and to remember the words of the Lord Jesus, how he said, It is more blessed to give than to receive.",
  ],
  "not-ashamed-of-the-gospel": [
    "For I am not ashamed of the gospel of Christ: for it is the power of God unto salvation to every one that believeth; to the Jew first, and also to the Greek.",
  ],
  "all-have-sinned": [
    "For all have sinned, and come short of the glory of God;",
  ],
  "while-we-were-yet-sinners": [
    "But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.",
  ],
  "the-wages-of-sin": [
    "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.",
  ],
  "no-condemnation": [
    "There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.",
  ],
  "all-things-work-together": [
    "And we know that all things work together for good to them that love God, to them who are the called according to his purpose.",
  ],
  "if-god-is-for-us": [
    "What shall we then say to these things? If God be for us, who can be against us?",
  ],
  "nothing-can-separate-us": [
    "For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,",
    "Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.",
  ],
  "confess-with-your-mouth": [
    "That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.",
    "For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation.",
  ],
  "whoever-calls-on-the-name": [
    "For whosoever shall call upon the name of the Lord shall be saved.",
  ],
  "a-living-sacrifice": [
    "I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service.",
    "And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.",
  ],
  "let-love-be-without-hypocrisy": [
    "Let love be without dissimulation. Abhor that which is evil; cleave to that which is good.",
    "Be kindly affectioned one to another with brotherly love; in honour preferring one another;",
    "Not slothful in business; fervent in spirit; serving the Lord;",
    "Rejoicing in hope; patient in tribulation; continuing instant in prayer;",
    "Distributing to the necessity of saints; given to hospitality.",
  ],
  "overcome-evil-with-good": [
    "Be not overcome of evil, but overcome evil with good.",
  ],
  "the-god-of-hope": [
    "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.",
  ],
  "a-way-of-escape": [
    "There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it.",
  ],
  "do-all-to-the-glory-of-god": [
    "Whether therefore ye eat, or drink, or whatsoever ye do, do all to the glory of God.",
  ],
  "love-is-patient": [
    "Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,",
    "Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;",
    "Rejoiceth not in iniquity, but rejoiceth in the truth;",
    "Beareth all things, believeth all things, hopeth all things, endureth all things.",
    "Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away.",
  ],
  "faith-hope-and-love": [
    "And now abideth faith, hope, charity, these three; but the greatest of these is charity.",
  ],
  "always-abounding": [
    "Therefore, my beloved brethren, be ye stedfast, unmoveable, always abounding in the work of the Lord, forasmuch as ye know that your labour is not in vain in the Lord.",
  ],
  "let-all-you-do-be-done-in-love": [
    "Watch ye, stand fast in the faith, quit you like men, be strong.",
    "Let all your things be done with charity.",
  ],
  "a-new-creation": [
    "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.",
  ],
  "a-cheerful-giver": [
    "Every man according as he purposeth in his heart, so let him give; not grudgingly, or of necessity: for God loveth a cheerful giver.",
  ],
  "my-grace-is-sufficient": [
    "And he said unto me, My grace is sufficient for thee: for my strength is made perfect in weakness. Most gladly therefore will I rather glory in my infirmities, that the power of Christ may rest upon me.",
  ],
  "not-losing-heart": [
    "For which cause we faint not; but though our outward man perish, yet the inward man is renewed day by day.",
    "For our light affliction, which is but for a moment, worketh for us a far more exceeding and eternal weight of glory;",
    "While we look not at the things which are seen, but at the things which are not seen: for the things which are seen are temporal; but the things which are not seen are eternal.",
  ],
  "crucified-with-christ": [
    "I am crucified with Christ: nevertheless I live; yet not I, but Christ liveth in me: and the life which I now live in the flesh I live by the faith of the Son of God, who loved me, and gave himself for me.",
  ],
  "the-fruit-of-the-spirit": [
    "But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,",
    "Meekness, temperance: against such there is no law.",
  ],
  "dont-grow-weary": [
    "And let us not be weary in well doing: for in due season we shall reap, if we faint not.",
  ],
  "by-grace-through-faith": [
    "For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:",
    "Not of works, lest any man should boast.",
    "For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them.",
  ],
  "exceedingly-abundantly": [
    "Now unto him that is able to do exceeding abundantly above all that we ask or think, according to the power that worketh in us,",
    "Unto him be glory in the church by Christ Jesus throughout all ages, world without end. Amen.",
  ],
  "no-corrupt-speech": [
    "Let no corrupt communication proceed out of your mouth, but that which is good to the use of edifying, that it may minister grace unto the hearers.",
  ],
  "be-kind-to-one-another": [
    "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you.",
  ],
  "children-obey-your-parents": [
    "Children, obey your parents in the Lord: for this is right.",
    "Honour thy father and mother; (which is the first commandment with promise;)",
    "That it may be well with thee, and thou mayest live long on the earth.",
  ],
  "the-whole-armour-of-god": [
    "Finally, my brethren, be strong in the Lord, and in the power of his might.",
    "Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.",
    "For we wrestle not against flesh and blood, but against principalities, against powers, against the rulers of the darkness of this world, against spiritual wickedness in high places.",
    "Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand.",
    "Stand therefore, having your loins girt about with truth, and having on the breastplate of righteousness;",
    "And your feet shod with the preparation of the gospel of peace;",
    "Above all, taking the shield of faith, wherewith ye shall be able to quench all the fiery darts of the wicked.",
    "And take the helmet of salvation, and the sword of the Spirit, which is the word of God:",
    "Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints;",
  ],
  "he-who-began-a-good-work": [
    "Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:",
  ],
  "in-humility-count-others": [
    "Let nothing be done through strife or vainglory; but in lowliness of mind let each esteem other better than themselves.",
    "Look not every man on his own things, but every man also on the things of others.",
  ],
  "rejoice-in-the-lord-always": [
    "Rejoice in the Lord alway: and again I say, Rejoice.",
    "Let your moderation be known unto all men. The Lord is at hand.",
    "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.",
    "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.",
  ],
  "whatever-is-true": [
    "Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things.",
  ],
  "i-can-do-all-things": [
    "I can do all things through Christ which strengtheneth me.",
  ],
  "my-god-will-supply": [
    "But my God shall supply all your need according to his riches in glory by Christ Jesus.",
  ],
  "put-on-love": [
    "Put on therefore, as the elect of God, holy and beloved, bowels of mercies, kindness, humbleness of mind, meekness, longsuffering;",
    "Forbearing one another, and forgiving one another, if any man have a quarrel against any: even as Christ forgave you, so also do ye.",
    "And above all these things put on charity, which is the bond of perfectness.",
  ],
  "children-obey-in-all-things": [
    "Children, obey your parents in all things: for this is well pleasing unto the Lord.",
  ],
  "work-heartily": [
    "And what soever ye do, do it heartily, as to the Lord, and not unto men;",
    "Knowing that of the Lord ye shall receive the reward of the inheritance: for ye serve the Lord Christ.",
  ],
  "rejoice-always": [
    "Rejoice evermore.",
    "Pray without ceasing.",
    "In every thing give thanks: for this is the will of God in Christ Jesus concerning you.",
  ],
  "a-spirit-of-power": [
    "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.",
  ],
  "rightly-handling-the-word": [
    "Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.",
  ],
  "all-scripture-is-god-breathed": [
    "All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:",
    "That the man of God may be perfect, throughly furnished unto all good works.",
  ],
  "the-word-is-living": [
    "For the word of God is quick, and powerful, and sharper than any twoedged sword, piercing even to the dividing asunder of soul and spirit, and of the joints and marrow, and is a discerner of the thoughts and intents of the heart.",
  ],
  "provoke-one-another-to-love": [
    "And let us consider one another to provoke unto love and to good works:",
    "Not forsaking the assembling of ourselves together, as the manner of some is; but exhorting one another: and so much the more, as ye see the day approaching.",
  ],
  "faith-is-assurance": [
    "Now faith is the substance of things hoped for, the evidence of things not seen.",
  ],
  "without-faith-it-is-impossible": [
    "But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him.",
  ],
  "run-with-endurance": [
    "Wherefore seeing we also are compassed about with so great a cloud of witnesses, let us lay aside every weight, and the sin which doth so easily beset us, and let us run with patience the race that is set before us,",
    "Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame, and is set down at the right hand of the throne of God.",
  ],
  "the-same-yesterday-today-forever": [
    "Jesus Christ the same yesterday, and to day, and for ever.",
  ],
  "count-it-all-joy": [
    "My brethren, count it all joy when ye fall into divers temptations;",
    "Knowing this, that the trying of your faith worketh patience.",
    "But let patience have her perfect work, that ye may be perfect and entire, wanting nothing.",
  ],
  "if-any-of-you-lacks-wisdom": [
    "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.",
  ],
  "every-good-gift": [
    "Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning.",
  ],
  "swift-to-hear": [
    "Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath:",
    "For the wrath of man worketh not the righteousness of God.",
  ],
  "be-doers-of-the-word": [
    "But be ye doers of the word, and not hearers only, deceiving your own selves.",
  ],
  "a-chosen-generation": [
    "But ye are a chosen generation, a royal priesthood, an holy nation, a peculiar people; that ye should shew forth the praises of him who hath called you out of darkness into his marvellous light:",
  ],
  "always-be-ready": [
    "But sanctify the Lord God in your hearts: and be ready always to give an answer to every man that asketh you a reason of the hope that is in you with meekness and fear:",
  ],
  "cast-all-your-worry": [
    "Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time:",
    "Casting all your care upon him; for he careth for you.",
  ],
  "not-slow-about-his-promise": [
    "The Lord is not slack concerning his promise, as some men count slackness; but is longsuffering to us-ward, not willing that any should perish, but that all should come to repentance.",
  ],
  "grow-in-grace": [
    "But grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ. To him be glory both now and for ever. Amen.",
  ],
  "if-we-confess-our-sins": [
    "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.",
  ],
  "see-what-love": [
    "Behold, what manner of love the Father hath bestowed upon us, that we should be called the sons of God: therefore the world knoweth us not, because it knew him not.",
  ],
  "love-in-deed-and-truth": [
    "My little children, let us not love in word, neither in tongue; but in deed and in truth.",
  ],
  "love-is-of-god": [
    "Beloved, let us love one another: for love is of God; and every one that loveth is born of God, and knoweth God.",
    "He that loveth not knoweth not God; for God is love.",
  ],
  "we-love-because-he-first-loved-us": [
    "We love him, because he first loved us.",
  ],
  "i-stand-at-the-door": [
    "Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me.",
  ],
  "he-will-wipe-away-every-tear": [
    "And I heard a great voice out of heaven saying, Behold, the tabernacle of God is with men, and he will dwell with them, and they shall be his people, and God himself shall be with them, and be their God.",
    "And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.",
  ],
};

/**
 * Credit for the KJV option. Not the constant the WEBu has — that one names a
 * specific release of a trademarked name and belongs beside it in scripture.ts.
 */
export const KJV_CREDIT =
  "Scripture: King James Version (public domain) · ebible.org";
