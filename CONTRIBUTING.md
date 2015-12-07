# Contribution

## General Guidelines
Style enhancements are alyways welcome. 

I will check out pull request so feel free to create your own fork and improve the app in order to help the PoE community understand crafting :)

Other than that please have a look at the [issue section](https://github.com/eps1lon/poe_mod_repository/issues).

## Code style
Nothing fancy but it should pass the default configuration on http://jshint.com 

## Content.ggpk
Patches to PoE oftentimes introduce new `.dat` Files or changes to existing `.dat` files. 
If these changes affect used `.dat` files its important to understand these changes. Our current understanding of
`Content.ggpk` is fully derived from [PyPoE](https://github.com/OmegaK2/PyPoE). Pls contribute to the `dat.specification.ini` listed there.

## Getting JSON data
* extract `DATA` and `MetaData` from `Content.ggpk` via pypoe_ui
* convert all `.dat` files into a format your dsl can understand 
e.g. use libggpk/DatConverter to generate csv files and import them into sql
* dont alter the format of the json files without permission of the owner of this repository

### Example tasks
TODO
