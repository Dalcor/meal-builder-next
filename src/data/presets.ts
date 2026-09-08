import type { Product } from '../types';

export interface PresetProduct {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface PresetCategory {
  name: string;
  items: PresetProduct[];
}

// Stable id per preset (FNV-1a over category + name). Random ids made
// seeding non-idempotent: a second run (e.g. after a backup restore lost
// the "seeded" marker) produced a full set of duplicates. With stable ids
// HSET simply overwrites the same fields.
function presetId(category: string, name: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${category}|${name}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `preset-${h.toString(16).padStart(8, '0')}`;
}

export function buildSeedProducts(): Product[] {
  return presetCategories.flatMap(cat =>
    cat.items.map<Product>(item => ({
      id: presetId(cat.name, item.name),
      name: item.name,
      calories: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      category: cat.name,
    })),
  );
}

export const presetCategories: PresetCategory[] = [
  {
    name: 'Крупи та гарніри',
    items: [
      { name: 'Гречка (варена)', calories: 110, protein: 4.2, fat: 1.1, carbs: 21.3 },
      { name: 'Рис білий (варений)', calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2 },
      { name: 'Рис бурий (варений)', calories: 112, protein: 2.3, fat: 0.8, carbs: 23.5 },
      { name: 'Вівсянка (варена)', calories: 88, protein: 3, fat: 1.7, carbs: 15 },
      { name: 'Перловка (варена)', calories: 109, protein: 3.1, fat: 0.4, carbs: 22.2 },
      { name: 'Булгур (варений)', calories: 83, protein: 3.1, fat: 0.2, carbs: 18.6 },
      { name: 'Кускус (варений)', calories: 112, protein: 3.8, fat: 0.2, carbs: 23.2 },
      { name: 'Пшоно (варене)', calories: 90, protein: 3, fat: 0.8, carbs: 17 },
      { name: 'Макарони (варені)', calories: 131, protein: 5.1, fat: 1.1, carbs: 27.7 },
      { name: 'Картопля (варена)', calories: 82, protein: 2, fat: 0.4, carbs: 16.7 },
      { name: 'Картопля (печена)', calories: 93, protein: 2.5, fat: 0.1, carbs: 21.2 },
      { name: 'Хліб білий', calories: 265, protein: 9, fat: 3.2, carbs: 49 },
      { name: 'Хліб чорний', calories: 174, protein: 6.6, fat: 1.2, carbs: 33.4 },
    ],
  },
  {
    name: "М'ясо",
    items: [
      { name: 'Куряча грудка (варена)', calories: 165, protein: 31, fat: 3.6, carbs: 0 },
      { name: 'Куряче стегно (варене)', calories: 209, protein: 26, fat: 10.9, carbs: 0 },
      { name: 'Індичка (грудка)', calories: 157, protein: 30, fat: 3.2, carbs: 0 },
      { name: 'Яловичина (варена нежирна)', calories: 175, protein: 25.8, fat: 8, carbs: 0 },
      { name: 'Яловичина (стейк)', calories: 271, protein: 26, fat: 18, carbs: 0 },
      { name: 'Свинина (нежирна)', calories: 160, protein: 22.6, fat: 7.1, carbs: 0 },
      { name: 'Свинина (жирна)', calories: 316, protein: 17, fat: 27.8, carbs: 0 },
      { name: 'Фарш курячий', calories: 143, protein: 17.4, fat: 8.1, carbs: 0 },
      { name: 'Фарш яловичий', calories: 254, protein: 17.2, fat: 20, carbs: 0 },
      { name: 'Печінка куряча', calories: 136, protein: 19.1, fat: 6.2, carbs: 0.6 },
      { name: 'Сало', calories: 797, protein: 1.4, fat: 89, carbs: 0 },
    ],
  },
  {
    name: 'Риба та морепродукти',
    items: [
      { name: 'Лосось (запечений)', calories: 208, protein: 20.4, fat: 13.4, carbs: 0 },
      { name: 'Тунець (консерва у воді)', calories: 116, protein: 25.5, fat: 1, carbs: 0 },
      { name: 'Скумбрія (запечена)', calories: 262, protein: 24, fat: 17.8, carbs: 0 },
      { name: 'Тріска (варена)', calories: 82, protein: 17.8, fat: 0.7, carbs: 0 },
      { name: 'Мінтай (варений)', calories: 79, protein: 17.6, fat: 1, carbs: 0 },
      { name: 'Креветки (варені)', calories: 99, protein: 20.9, fat: 1.7, carbs: 0.2 },
      { name: 'Кальмар (варений)', calories: 110, protein: 18, fat: 2.2, carbs: 3.6 },
      { name: 'Оселедець', calories: 217, protein: 19.8, fat: 15.4, carbs: 0 },
      { name: 'Судак (запечений)', calories: 97, protein: 21.3, fat: 1.3, carbs: 0 },
    ],
  },
  {
    name: 'Молочні продукти та яйця',
    items: [
      { name: 'Яйце куряче (1 шт ~60г)', calories: 155, protein: 12.6, fat: 10.6, carbs: 1.1 },
      { name: 'Молоко 2.5%', calories: 52, protein: 2.8, fat: 2.5, carbs: 4.7 },
      { name: 'Кефір 1%', calories: 40, protein: 3.3, fat: 1, carbs: 4.5 },
      { name: 'Сметана 15%', calories: 162, protein: 2.6, fat: 15, carbs: 3.6 },
      { name: 'Сметана 20%', calories: 206, protein: 2.8, fat: 20, carbs: 3.2 },
      { name: 'Творог 5%', calories: 121, protein: 17.2, fat: 5, carbs: 1.8 },
      { name: 'Творог 9%', calories: 159, protein: 16.7, fat: 9, carbs: 2 },
      { name: 'Творог знежирений', calories: 86, protein: 18, fat: 0.6, carbs: 1.5 },
      { name: 'Сир твердий', calories: 356, protein: 24.1, fat: 29.5, carbs: 0.3 },
      { name: 'Сир моцарелла', calories: 280, protein: 22.2, fat: 22.4, carbs: 2.2 },
      { name: 'Масло вершкове', calories: 717, protein: 0.9, fat: 81.1, carbs: 0.1 },
      { name: 'Йогурт натуральний', calories: 60, protein: 4.3, fat: 1.5, carbs: 7.7 },
    ],
  },
  {
    name: 'Овочі',
    items: [
      { name: 'Помідор', calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9 },
      { name: 'Огірок', calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6 },
      { name: 'Капуста білокачанна', calories: 25, protein: 1.3, fat: 0.1, carbs: 5.8 },
      { name: 'Морква (сира)', calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6 },
      { name: 'Редис', calories: 20, protein: 1.2, fat: 0.1, carbs: 3.4 },
      { name: 'Буряк (варений)', calories: 49, protein: 1.8, fat: 0.1, carbs: 10.8 },
      { name: 'Цибуля', calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3 },
      { name: 'Перець болгарський', calories: 27, protein: 1.3, fat: 0, carbs: 5.3 },
      { name: 'Кабачок', calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1 },
      { name: 'Баклажан', calories: 25, protein: 1, fat: 0.2, carbs: 4.5 },
      { name: 'Броколі', calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6 },
      { name: 'Цвітна капуста', calories: 25, protein: 1.9, fat: 0.3, carbs: 5 },
      { name: 'Шпинат', calories: 23, protein: 2.9, fat: 0.3, carbs: 3.6 },
      { name: 'Гриби шампіньйони', calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3 },
      { name: 'Часник', calories: 149, protein: 6.5, fat: 0.5, carbs: 29.9 },
      { name: 'Зелень (петрушка, кріп)', calories: 36, protein: 3, fat: 0.5, carbs: 6.3 },
      { name: 'Салат листовий', calories: 15, protein: 1.4, fat: 0.2, carbs: 2.9 },
      { name: 'Кукурудза (варена)', calories: 96, protein: 3.4, fat: 1.5, carbs: 21 },
      { name: 'Горошок зелений', calories: 81, protein: 5.4, fat: 0.4, carbs: 14.5 },
    ],
  },
  {
    name: 'Фрукти та ягоди',
    items: [
      { name: 'Яблуко', calories: 52, protein: 0.3, fat: 0.2, carbs: 14 },
      { name: 'Банан', calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
      { name: 'Апельсин', calories: 43, protein: 0.9, fat: 0.1, carbs: 10.6 },
      { name: 'Мандарин', calories: 53, protein: 0.8, fat: 0.3, carbs: 13.3 },
      { name: 'Груша', calories: 57, protein: 0.4, fat: 0.1, carbs: 15.2 },
      { name: 'Виноград', calories: 69, protein: 0.7, fat: 0.2, carbs: 18.1 },
      { name: 'Кавун', calories: 30, protein: 0.6, fat: 0.2, carbs: 7.6 },
      { name: 'Диня', calories: 34, protein: 0.8, fat: 0.2, carbs: 8.2 },
      { name: 'Полуниця', calories: 32, protein: 0.7, fat: 0.3, carbs: 7.7 },
      { name: 'Малина', calories: 52, protein: 1.2, fat: 0.7, carbs: 11.9 },
      { name: 'Чорниця', calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5 },
      { name: 'Лохина', calories: 39, protein: 0.5, fat: 0.3, carbs: 9.7 },
      { name: 'Вишня', calories: 50, protein: 1, fat: 0.3, carbs: 12.2 },
      { name: 'Слива', calories: 46, protein: 0.7, fat: 0.3, carbs: 11.4 },
      { name: 'Персик', calories: 39, protein: 0.9, fat: 0.3, carbs: 9.5 },
      { name: 'Ківі', calories: 61, protein: 1.1, fat: 0.5, carbs: 14.7 },
      { name: 'Авокадо', calories: 160, protein: 2, fat: 14.7, carbs: 8.5 },
    ],
  },
  {
    name: 'Бобові та горіхи',
    items: [
      { name: 'Квасоля (варена)', calories: 127, protein: 8.7, fat: 0.5, carbs: 21.4 },
      { name: 'Нут (варений)', calories: 164, protein: 8.9, fat: 2.6, carbs: 27.4 },
      { name: 'Сочевиця (варена)', calories: 116, protein: 9, fat: 0.4, carbs: 20.1 },
      { name: 'Горіх волоський', calories: 654, protein: 15.2, fat: 65.2, carbs: 13.7 },
      { name: 'Мигдаль', calories: 579, protein: 21.2, fat: 49.9, carbs: 21.6 },
      { name: 'Арахіс', calories: 567, protein: 25.8, fat: 49.2, carbs: 16.1 },
      { name: 'Кешʼю', calories: 553, protein: 18.2, fat: 43.9, carbs: 30.2 },
      { name: 'Насіння соняшника', calories: 584, protein: 20.8, fat: 51.5, carbs: 20 },
    ],
  },
  {
    name: 'Олії та соуси',
    items: [
      { name: 'Олія соняшникова', calories: 884, protein: 0, fat: 99.9, carbs: 0 },
      { name: 'Олія оливкова', calories: 884, protein: 0, fat: 99.8, carbs: 0 },
      { name: 'Майонез', calories: 680, protein: 1, fat: 74.9, carbs: 2.6 },
      { name: 'Кетчуп', calories: 112, protein: 1.8, fat: 1, carbs: 22.2 },
      { name: 'Соєвий соус', calories: 53, protein: 8.1, fat: 0, carbs: 4.9 },
      { name: 'Мед', calories: 329, protein: 0.8, fat: 0, carbs: 81.5 },
      { name: 'Цукор', calories: 398, protein: 0, fat: 0, carbs: 99.7 },
    ],
  },
];
