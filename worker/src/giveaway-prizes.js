// Каталог призів розіграшу в рейді (офіцер обирає з нього). Назви, іконки
// й якість звірені з Wowhead за ID предмета (WotLK). Золото - окремий тип
// призу (сума вказується при старті розіграшу), тут його немає.
// Згенеровано скриптом - при доповненні перевіряй ID на Wowhead.

export const GIVEAWAY_PRIZE_CATEGORIES = [
  {
    "key": "potions",
    "label": "Зілля та трави"
  },
  {
    "key": "flasks",
    "label": "Флакони"
  },
  {
    "key": "feasts",
    "label": "Бенкети"
  },
  {
    "key": "materials",
    "label": "Матеріали"
  },
  {
    "key": "other",
    "label": "Інше"
  },
  {
    "key": "gems-red",
    "label": "Камені: червоні"
  },
  {
    "key": "gems-yellow",
    "label": "Камені: жовті"
  },
  {
    "key": "gems-blue",
    "label": "Камені: сині"
  },
  {
    "key": "gems-purple",
    "label": "Камені: фіолетові"
  },
  {
    "key": "gems-orange",
    "label": "Камені: помаранчеві"
  },
  {
    "key": "gems-green",
    "label": "Камені: зелені"
  },
  {
    "key": "boe",
    "label": "Фіолетові BoE (треш ЦЛК)"
  }
];

export const GIVEAWAY_PRIZES = [
  {"id":22788,"name":"Flame Cap","icon":"inv_misc_herb_flamecap","quality":1,"category":"potions"},
  {"id":40211,"name":"Potion of Speed","icon":"inv_alchemy_elixir_04","quality":1,"category":"potions"},
  {"id":40212,"name":"Potion of Wild Magic","icon":"inv_alchemy_elixir_01","quality":1,"category":"potions"},
  {"id":40093,"name":"Indestructible Potion","icon":"inv_alchemy_elixir_empty","quality":1,"category":"potions"},
  {"id":33447,"name":"Runic Healing Potion","icon":"inv_alchemy_elixir_05","quality":1,"category":"potions"},
  {"id":33448,"name":"Runic Mana Potion","icon":"inv_alchemy_elixir_02","quality":1,"category":"potions"},
  {"id":40087,"name":"Powerful Rejuvenation Potion","icon":"inv_alchemy_elixir_06","quality":1,"category":"potions"},
  {"id":46376,"name":"Flask of the Frost Wyrm","icon":"inv_alchemy_endlessflask_04","quality":1,"category":"flasks"},
  {"id":46377,"name":"Flask of Endless Rage","icon":"inv_alchemy_endlessflask_06","quality":1,"category":"flasks"},
  {"id":46378,"name":"Flask of Pure Mojo","icon":"inv_alchemy_endlessflask_03","quality":1,"category":"flasks"},
  {"id":46379,"name":"Flask of Stoneblood","icon":"inv_alchemy_endlessflask_05","quality":1,"category":"flasks"},
  {"id":43015,"name":"Fish Feast","icon":"inv_misc_fish_52","quality":1,"category":"feasts"},
  {"id":34753,"name":"Great Feast","icon":"ability_hunter_pet_boar","quality":1,"category":"feasts"},
  {"id":49908,"name":"Primordial Saronite","icon":"spell_fire_felflamebreath","quality":3,"category":"materials"},
  {"id":41119,"name":"Saronite Bomb","icon":"inv_misc_enggizmos_32","quality":1,"category":"other"},
  {"id":40111,"name":"Bold Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40112,"name":"Delicate Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40113,"name":"Runed Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40114,"name":"Bright Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40115,"name":"Subtle Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40116,"name":"Flashing Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40117,"name":"Fractured Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40118,"name":"Precise Cardinal Ruby","icon":"inv_jewelcrafting_gem_37","quality":4,"category":"gems-red"},
  {"id":40123,"name":"Brilliant King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40124,"name":"Smooth King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40125,"name":"Rigid King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40126,"name":"Thick King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40127,"name":"Mystic King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40128,"name":"Quick King's Amber","icon":"inv_jewelcrafting_gem_38","quality":4,"category":"gems-yellow"},
  {"id":40119,"name":"Solid Majestic Zircon","icon":"inv_jewelcrafting_gem_42","quality":4,"category":"gems-blue"},
  {"id":40120,"name":"Sparkling Majestic Zircon","icon":"inv_jewelcrafting_gem_42","quality":4,"category":"gems-blue"},
  {"id":40121,"name":"Lustrous Majestic Zircon","icon":"inv_jewelcrafting_gem_42","quality":4,"category":"gems-blue"},
  {"id":40122,"name":"Stormy Majestic Zircon","icon":"inv_jewelcrafting_gem_42","quality":4,"category":"gems-blue"},
  {"id":40129,"name":"Sovereign Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40130,"name":"Shifting Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40131,"name":"Tenuous Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40132,"name":"Glowing Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40133,"name":"Purified Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40134,"name":"Royal Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40135,"name":"Mysterious Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40136,"name":"Balanced Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40137,"name":"Infused Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40138,"name":"Regal Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40139,"name":"Defender's Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40140,"name":"Puissant Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40141,"name":"Guardian's Dreadstone","icon":"inv_jewelcrafting_gem_40","quality":4,"category":"gems-purple"},
  {"id":40142,"name":"Inscribed Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40143,"name":"Etched Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40144,"name":"Champion's Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40145,"name":"Resplendent Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40146,"name":"Fierce Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40147,"name":"Deadly Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40148,"name":"Glinting Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40149,"name":"Lucent Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40150,"name":"Deft Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40151,"name":"Luminous Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40152,"name":"Potent Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40153,"name":"Veiled Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40154,"name":"Durable Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40155,"name":"Reckless Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40156,"name":"Wicked Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40157,"name":"Pristine Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40158,"name":"Empowered Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40159,"name":"Stark Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40160,"name":"Stalwart Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40161,"name":"Glimmering Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40162,"name":"Accurate Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40163,"name":"Resolute Ametrine","icon":"inv_jewelcrafting_gem_39","quality":4,"category":"gems-orange"},
  {"id":40164,"name":"Timeless Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40165,"name":"Jagged Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40166,"name":"Vivid Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40167,"name":"Enduring Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40168,"name":"Steady Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40169,"name":"Forceful Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40170,"name":"Seer's Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40171,"name":"Misty Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40172,"name":"Shining Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40173,"name":"Turbid Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40174,"name":"Intricate Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40175,"name":"Dazzling Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40176,"name":"Sundered Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40177,"name":"Lambent Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40178,"name":"Opaque Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40179,"name":"Energized Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40180,"name":"Radiant Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40181,"name":"Tense Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":40182,"name":"Shattered Eye of Zul","icon":"inv_jewelcrafting_gem_41","quality":4,"category":"gems-green"},
  {"id":50452,"name":"Wodin's Lucky Necklace","icon":"inv_misc_pelt_wolf_ruin_01","quality":4,"category":"boe"},
  {"id":50447,"name":"Harbinger's Bone Band","icon":"inv_jewelry_ring_84","quality":4,"category":"boe"},
  {"id":50453,"name":"Ring of Rotting Sinew","icon":"inv_jewelry_ring_81","quality":4,"category":"boe"},
  {"id":50449,"name":"Stiffened Corpse Shoulderpads","icon":"inv_shoulder_119","quality":4,"category":"boe"},
  {"id":50450,"name":"Leggings of Dubious Charms","icon":"inv_pants_mail_35","quality":4,"category":"boe"},
  {"id":50451,"name":"Belt of the Lonely Noble","icon":"inv_belt_70","quality":4,"category":"boe"},
  {"id":50444,"name":"Rowan's Rifle of Silver Bullets","icon":"inv_weapon_rifle_39","quality":4,"category":"boe"}
];

export const GIVEAWAY_PRIZES_BY_ID = new Map(GIVEAWAY_PRIZES.map((p) => [p.id, p]));
