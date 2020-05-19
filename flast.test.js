import parseUnits from './parse-units'

test('parses stuff correctly', () => {
  expect(parseUnits('2m')).toStrictEqual({ value: 6.562, units: 'feet' })
  expect(parseUnits('2m 1ft')).toStrictEqual({ value: 7.562, units: 'feet' })
  expect(parseUnits('5\'2"')).toStrictEqual({ value: 5.166666666666667, units: 'feet' })
  expect(parseUnits('6\' 9"')).toStrictEqual({ value: 6.75, units: 'feet' })
  expect(parseUnits('6ft 9in"')).toStrictEqual({ value: 6.75, units: 'feet' })
  expect(parseUnits('6ft9in"')).toStrictEqual({ value: 6.75, units: 'feet' })
  expect(parseUnits('')).toStrictEqual(null)
  expect(parseUnits(null)).toStrictEqual(null)
})
