export type EntityId = string;
export type TurnId = string;
export type StateVersion = number;
export type Sequence = number;
export type Timestamp = string;

export type ScalarValue = string | number | boolean | null;
export type SerializableValue =
  | ScalarValue
  | readonly SerializableValue[]
  | { readonly [key: string]: SerializableValue };
