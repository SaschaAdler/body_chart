# body_chart

Generates body chart images from correctly-shaped CSV data.

## Prerequisites

- [Git](https://git-scm.com/)
- [Deno](https://deno.land/) (make sure your installation root is in your
  `PATH`)
- [ImageMagick](https://imagemagick.org/script/index.php)

## Installation

Clone this repo:

    git clone https://github.com/SaschaAdler/body-chart

Install:

    deno install --allow-read --allow-write --allow-run=convert ./body_chart.ts

## Usage

    body_chart file.csv
    body_chart path/to/file.csv path/to/otherfile.csv
    body_chart *.csv

Images for an input file are created in the directory the file is in.
