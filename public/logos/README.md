# Organizer logos

The homepage organizer section (`src/app/page.tsx`) renders five logo slots from
this folder. Keep these exact filenames when replacing artwork:

| Slot     | File                        | Served at              | `alt` text       |
| :------- | :-------------------------- | :--------------------- | :--------------- |
| IIC      | `public/logos/iic.png`      | `/logos/iic.png`       | `IIC logo`       |
| EMDC     | `public/logos/emdc.png`     | `/logos/emdc.png`      | `EMDC logo`      |
| IDEA Lab | `public/logos/idea-lab.png` | `/logos/idea-lab.png`  | `IDEA Lab logo`  |
| TBI      | `public/logos/tbi.png`      | `/logos/tbi.png`       | `TBI logo`       |
| KEC      | `public/logos/kec.png`      | `/logos/kec.png`       | `KEC logo`       |

Notes:

- PNG works out of the box. If you supply another format, update both the
  filename here and the `src` values in `ORGANIZER_LOGOS` in `src/app/page.tsx`.
- Each slot renders at a fixed height (`h-14` / 56px) with auto width, so supply
  reasonably high-resolution images (roughly 2x, e.g. ~112px tall).
- Until a file exists, the slot falls back to a labelled placeholder box (the
  logo name) — no broken-image icon and no layout breakage.
