const CONST_KB = 1024,
      CONST_MB = CONST_KB*1024,
      CONST_GB = CONST_MB*1024,
      CONST_TB = CONST_GB*1024,
      CONST_PB = CONST_TB*1024

export function FormatteurNombre(props) {
    const value = props.value
    const precision = props.precision || 3
    
    if(!value) return ''

    let result = ''
    if(value >= 1000) result = Math.floor(value)
    else result = value.toPrecision(precision)
    const label = result

    return <span>{label}</span>
}

export function FormatteurTaille(props) {
    const value = props.value
    const precision = props.precision || 3
  
    if(!value) return ''

    let valueCalculated, unit
    if(value > CONST_PB) {
        valueCalculated = (value/CONST_PB)
        unit = 'Pb'
    } else if(value > CONST_TB) {
        valueCalculated = (value/CONST_TB)
        unit = 'Tb'
    } else if(value > CONST_GB) {
        valueCalculated = (value/CONST_GB)
        unit = 'Gb'
    } else if(value > CONST_MB) {
        valueCalculated = (value/CONST_MB)
        unit = 'Mb'
    } else if(value > CONST_KB) {
        valueCalculated = (value/CONST_KB)
        unit = 'kb'
    } else {
        // result = value
        unit = 'bytes'
    }

    let result = value
    if(valueCalculated) {
        if(valueCalculated >= 1000) result = Math.floor(valueCalculated)
        else result = valueCalculated.toPrecision(precision)
    }
    const label = result + ' ' + unit

    return <span>{label}</span>
}
