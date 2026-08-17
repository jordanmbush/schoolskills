/**
 * Units, as whole numbers of the smallest one.
 *
 * The same bargain `exact.ts` strikes with a decimal, made for measurement: a
 * kilometre is 1 000 000 millimetres and a mile is 63 360 inches, both exactly,
 * so every conversion in the shop is a multiplication or an exact division of
 * whole numbers and nothing here ever holds 0.1 of anything. A sheet whose key
 * says `2.9999999999999996 m` is the failure this file exists to make
 * impossible.
 *
 * **Nothing converts between the two systems.** 1 inch is 25.4 mm exactly, but 1
 * mile is 1609.344 metres and 1 pound is 453.59237 grams — and more to the
 * point, a child converting metres into feet is doing a different lesson from
 * the one this sheet sets. Every conversion here stays inside one system, so
 * every answer is a whole number of something.
 *
 * The names are the words each system's own schools use. Metric weighs mass in
 * grams; imperial weighs weight in pounds. It is one word on a title, and it is
 * the word a parent types into a search box.
 */
import type { Quantity, UnitSystem } from "../types";

import { own } from "../paper";

export type Unit = {
  /** How it is printed beside a number: "cm", "fl oz". */
  symbol: string;
  /** How many of the quantity's smallest unit this one is. Whole, always. */
  base: number;
};

export type Scale = {
  /** What this quantity is called on a sheet in this system. */
  name: string;
  /** Smallest first, which is the order a child meets them in. */
  units: Unit[];
};

/** The three quantities, in the order a picker would list them. */
export const QUANTITIES: Quantity[] = ["length", "mass", "capacity"];

export const SCALES: Record<UnitSystem, Record<Quantity, Scale>> = {
  metric: {
    length: {
      name: "length",
      units: [
        { symbol: "mm", base: 1 },
        { symbol: "cm", base: 10 },
        { symbol: "m", base: 1000 },
        { symbol: "km", base: 1000000 },
      ],
    },
    mass: {
      name: "mass",
      units: [
        { symbol: "g", base: 1 },
        { symbol: "kg", base: 1000 },
        { symbol: "t", base: 1000000 },
      ],
    },
    capacity: {
      name: "capacity",
      units: [
        { symbol: "ml", base: 1 },
        { symbol: "cl", base: 10 },
        { symbol: "l", base: 1000 },
      ],
    },
  },
  imperial: {
    length: {
      name: "length",
      units: [
        { symbol: "in", base: 1 },
        { symbol: "ft", base: 12 },
        { symbol: "yd", base: 36 },
        { symbol: "mi", base: 63360 },
      ],
    },
    mass: {
      name: "weight",
      units: [
        { symbol: "oz", base: 1 },
        { symbol: "lb", base: 16 },
        { symbol: "ton", base: 32000 },
      ],
    },
    capacity: {
      name: "capacity",
      units: [
        { symbol: "fl oz", base: 1 },
        { symbol: "cup", base: 8 },
        { symbol: "pt", base: 16 },
        { symbol: "qt", base: 32 },
        { symbol: "gal", base: 128 },
      ],
    },
  },
};

/**
 * The units of one quantity. Never throws: `system` and `quantity` both arrive
 * from outside this build, and a sheet bookmarked before a quantity was renamed
 * has to print something rather than fail — see the note on `own` for why a `??`
 * fallback is not one.
 */
export function scaleOf(system: UnitSystem, quantity: Quantity): Scale {
  const table = own(SCALES, system, SCALES.metric);
  return own(table, quantity, table.length);
}

/**
 * The units a shape on a page is measured in.
 *
 * Two of each, and the two a room or a garden is measured in. Millimetres and
 * miles are units of length that no worksheet has ever asked for the area of.
 */
export const FIGURE_UNITS: Record<UnitSystem, string[]> = {
  metric: ["cm", "m"],
  imperial: ["in", "ft"],
};

export const figureUnitsOf = (system: UnitSystem): string[] =>
  own(FIGURE_UNITS, system, FIGURE_UNITS.metric);

/** An amount as it is printed: the number, a space, the unit. */
export const amountText = (value: number, unit: Unit): string =>
  `${value} ${unit.symbol}`;

/** A unit of area, and one of volume: "cm²", "ft³". */
export const squared = (unit: string): string => `${unit}²`;
export const cubed = (unit: string): string => `${unit}³`;
