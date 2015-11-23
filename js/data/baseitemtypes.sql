SELECT item.`Rows` as `primary`, item.`Rows`, item.`Name`, item.ItemClass, 
    item.Width, item.Height, item.TagsKeys, item.Implicit_ModsKeys, 
    item.DropLevel, item.InheritsFrom,
    weapon.Critical, weapon.Speed, weapon.DamageMin, weapon.DamageMax, weapon.RangeMax,
    armour.Armour, armour.Evasion, armour.EnergyShield,
    requirements.ReqStr, requirements.ReqDex, requirements.RegInt as ReqInt
FROM baseitemtypes item
LEFT JOIN WeaponTypes weapon
    ON weapon.BaseItemTypesKey = item.Rows
LEFT JOIN ComponentArmour armour
    ON armour.VirtualPath = item.VirtualPath
LEFT JOIN ComponentAttributeRequirements requirements
    ON requirements.VirtualPath = item.VirtualPath
