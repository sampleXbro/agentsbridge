/**
 * SPDX license detection from raw LICENSE-file text.
 *
 * Detection is intentionally conservative: we recognize only the dozen most
 * common OSI/SPDX licenses by stable text fingerprints + explicit SPDX-id
 * markers. Anything else → null, so the caller can record "unknown" instead
 * of mislabeling exotic terms.
 */

import { describe, it, expect } from 'vitest';
import { detectSpdxLicense } from '../../../../src/install/license/detect-license.js';

describe('detectSpdxLicense', () => {
  it('recognizes an explicit SPDX-License-Identifier header (case-insensitive)', () => {
    expect(detectSpdxLicense('SPDX-License-Identifier: MIT\n\nsome text')).toBe('MIT');
    expect(detectSpdxLicense('spdx-license-identifier: Apache-2.0\n')).toBe('Apache-2.0');
  });

  it('recognizes MIT by its canonical permission grant', () => {
    const text = `MIT License

Copyright (c) 2024 Foo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software`;
    expect(detectSpdxLicense(text)).toBe('MIT');
  });

  it('recognizes Apache-2.0 by name + version banner', () => {
    const text = `                                 Apache License
                           Version 2.0, January 2004

Licensed under the Apache License, Version 2.0 (the "License");`;
    expect(detectSpdxLicense(text)).toBe('Apache-2.0');
  });

  it('distinguishes BSD-3-Clause from BSD-2-Clause by the neither-the-name clause', () => {
    const bsd3 = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice...
2. Redistributions in binary form must reproduce the above copyright notice...
3. Neither the name of the copyright holder nor the names of its contributors`;
    expect(detectSpdxLicense(bsd3)).toBe('BSD-3-Clause');

    const bsd2 = `Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice...
2. Redistributions in binary form must reproduce the above copyright notice`;
    expect(detectSpdxLicense(bsd2)).toBe('BSD-2-Clause');
  });

  it('recognizes GPL-3.0 and GPL-2.0 by version banner', () => {
    expect(
      detectSpdxLicense(
        '                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007',
      ),
    ).toBe('GPL-3.0');
    expect(
      detectSpdxLicense(
        '                    GNU GENERAL PUBLIC LICENSE\n                       Version 2, June 1991',
      ),
    ).toBe('GPL-2.0');
  });

  it('recognizes LGPL, AGPL, MPL-2.0, ISC, CC0, Unlicense by signature phrases', () => {
    expect(detectSpdxLicense('GNU LESSER GENERAL PUBLIC LICENSE\nVersion 3')).toBe('LGPL-3.0');
    expect(detectSpdxLicense('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3')).toBe('AGPL-3.0');
    expect(detectSpdxLicense('Mozilla Public License Version 2.0')).toBe('MPL-2.0');
    expect(
      detectSpdxLicense(
        'Permission to use, copy, modify, and/or distribute this software for any purpose',
      ),
    ).toBe('ISC');
    expect(
      detectSpdxLicense('This is free and unencumbered software released into the public domain.'),
    ).toBe('Unlicense');
    expect(detectSpdxLicense('Creative Commons CC0 1.0 Universal Public Domain Dedication')).toBe(
      'CC0-1.0',
    );
  });

  it('returns null for text that does not match any known license', () => {
    expect(detectSpdxLicense('')).toBeNull();
    expect(detectSpdxLicense('Copyright Foo. All rights reserved.')).toBeNull();
    expect(detectSpdxLicense('See LICENSE file.')).toBeNull();
  });

  it('returns null on empty or whitespace-only input', () => {
    expect(detectSpdxLicense('   \n\n\t')).toBeNull();
  });
});
