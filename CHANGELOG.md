# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **UI Enhancement**: In the Detail Panel for Object Classes and Interaction Classes, inherited attributes and parameters are now displayed in a grouped manner within the Attributes/Parameters table. Properties are rendered from the top-down starting with the current class's native properties, followed by the immediate parent's properties, all the way up to the root class. Each level is clearly demarcated by an inline header row indicating where the properties are inherited from.
- **UI Enhancement**: Added a "Module" column to the Interaction Class parameters table to mirror the Object Class attributes view, explicitly displaying which module each parameter is associated with.
- **UI Enhancement**: Attributes and parameters within the Details Panel are now sorted alphabetically by name within each of their respective hierarchical groups.
- **UI Enhancement**: Explicitly defined table layout column proportions for Object Class and Interaction Class properties tables to prevent extreme word-breaking and improve readability.
- **UI Enhancement**: Empty columns are now dynamically removed from Object Class and Interaction Class data tables, reclaiming horizontal layout space. A badge is displayed indicating which columns were omitted.
- **Bug Fix**: Fixed a bug where long contiguous strings (like identifiers) would overflow and bleed outside of the table boundaries by implementing stricter \overflow-wrap\ rules.
