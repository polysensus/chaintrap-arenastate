/*
 LocationChoices have at leat 4 choice menus.
 
 The first four are the 'side' menues representing the 4 sides of each location
 and the exits available on each respective side.

 Subsequent menus are identified by the following constants.
 */

export class LocationChoiceType {
  // For consistency, represent the sides as choice types also
  static North = 0;
  static West = 1;
  static South = 2;
  static East = 3;

  // Each menu entry identifies a chest that can be opened at this location.
  // The consequences of opening are not inferable from the id.
  static OpenChest = 4;
}
