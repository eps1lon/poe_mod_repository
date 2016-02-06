SELECT craftingbenchoptions.*, craftingbenchoptions.Rows as `primary`
    , npcs.Name as MasterName, npcs.NameShort as MasterNameShort 
    , craftingbenchoptions.ItemClassesKeys as BaseItemClassesKeys
FROM npcs, craftingbenchoptions 
WHERE ModsKey > -1 
    AND npcs.NPCMasterKey = craftingbenchoptions.NPCMasterKey 
GROUP BY craftingbenchoptions.Rows