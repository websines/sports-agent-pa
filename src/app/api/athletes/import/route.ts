import { NextResponse } from 'next/server';
import { db, athletes } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import mammoth from 'mammoth';
import { isLLMConfigured } from '@/lib/services/llm';
import OpenAI from 'openai';

const positions = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

// Parse athletes from text using LLM
async function parseAthletesWithLLM(text: string): Promise<AthleteData[]> {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
  });

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a data extractor for volleyball player information. Extract player data from the provided text.

For each player, extract:
- name: Full name
- position: One of: Setter, Outside Hitter, Opposite, Middle Blocker, Libero
- height: Height (e.g., "185cm" or "6'1\"")
- nationality: Country
- birthYear: Year of birth (number)
- notes: Any additional info (left-handed, speaks Japanese, etc.)
- profileUrl: Volleybox or similar URL if mentioned
- featured: true if marked with ** or "featured" or "priority"

Respond with a JSON array:
[{"name": "...", "position": "...", "height": "...", "nationality": "...", "birthYear": 1997, "notes": "...", "profileUrl": "...", "featured": false}]

If you can't determine a required field (name, position, nationality), skip that player.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse LLM response:', content);
  }

  return [];
}

// Extended list of countries
const countries = [
  'USA', 'United States', 'Japan', 'Brazil', 'Italy', 'Poland', 'France', 'Germany', 'Russia',
  'China', 'Korea', 'South Korea', 'Turkey', 'Hungary', 'Serbia', 'Bulgaria', 'Cuba',
  'Argentina', 'Puerto Rico', 'Dominican Republic', 'Canada', 'Australia', 'Netherlands',
  'Belgium', 'Spain', 'Portugal', 'Greece', 'Ukraine', 'Ukrain', 'Latvia', 'Sweden', 'Denmark',
  'Danmark', 'Finland', 'Norway', 'Czech Republic', 'Slovakia', 'Slovenia', 'Croatia',
  'Austria', 'Switzerland', 'Romania', 'Mexico', 'Venezuela', 'Colombia', 'Chile', 'Peru',
  'Egypt', 'Iran', 'Thailand', 'Indonesia', 'Philippines', 'Vietnam', 'Taiwan', 'India',
];

// Parse the Apex 8 Sports document format
function parseAthletesBasic(text: string): AthleteData[] {
  const athletes: AthleteData[] = [];
  const lines = text.split('\n').map((l) => l.trim());

  let currentPosition = '';
  let currentAthlete: Partial<AthleteData> | null = null;
  let collectingHighlights = false;
  let collectingProfile = false;
  let collectingStats = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) {
      // If we have a current athlete being built, save it
      if (currentAthlete && currentAthlete.name && currentAthlete.position && currentAthlete.nationality) {
        athletes.push(currentAthlete as AthleteData);
        currentAthlete = null;
      }
      collectingHighlights = false;
      collectingProfile = false;
      collectingStats = false;
      continue;
    }

    // Check for position headers (all caps, single word/phrase)
    const upperLine = line.toUpperCase();
    if (upperLine === 'SETTER' || upperLine === 'SETTERS') {
      currentPosition = 'Setter';
      continue;
    }
    if (upperLine === 'OUTSIDE HITTER' || upperLine === 'OUTSIDE HITTERS' || upperLine === 'OH') {
      currentPosition = 'Outside Hitter';
      continue;
    }
    if (upperLine === 'OPPOSITE' || upperLine === 'OPPOSITES' || upperLine === 'OPP') {
      currentPosition = 'Opposite';
      continue;
    }
    if (upperLine === 'MIDDLE BLOCKER' || upperLine === 'MIDDLE BLOCKERS' || upperLine === 'MB' || upperLine === 'MIDDLE') {
      currentPosition = 'Middle Blocker';
      continue;
    }
    if (upperLine === 'LIBERO' || upperLine === 'LIBEROS') {
      currentPosition = 'Libero';
      continue;
    }

    // Check for URL collection labels
    if (line.toLowerCase().startsWith('profile:') || line.toLowerCase() === 'profile') {
      collectingProfile = true;
      collectingHighlights = false;
      collectingStats = false;
      continue;
    }
    if (line.toLowerCase().startsWith('highlight') || line.toLowerCase() === 'highlights') {
      collectingHighlights = true;
      collectingProfile = false;
      collectingStats = false;
      continue;
    }
    if (line.toLowerCase().startsWith('stats') || line.toLowerCase().startsWith('video')) {
      collectingStats = true;
      collectingHighlights = false;
      collectingProfile = false;
      continue;
    }

    // Check if line is a URL
    if (line.startsWith('http://') || line.startsWith('https://')) {
      if (currentAthlete) {
        if (collectingProfile && line.includes('volleybox')) {
          currentAthlete.profileUrl = line;
        } else if (collectingHighlights && (line.includes('youtu') || line.includes('youtube'))) {
          if (!currentAthlete.highlightUrls) currentAthlete.highlightUrls = [];
          currentAthlete.highlightUrls.push(line);
        } else if (collectingStats && line.includes('drive.google')) {
          currentAthlete.statsUrl = line;
        } else if (line.includes('volleybox')) {
          currentAthlete.profileUrl = line;
        } else if (line.includes('youtu')) {
          if (!currentAthlete.highlightUrls) currentAthlete.highlightUrls = [];
          currentAthlete.highlightUrls.push(line);
        } else if (line.includes('drive.google')) {
          currentAthlete.statsUrl = line;
        }
      }
      continue;
    }

    // Try to parse as player info line
    // Format: "Name - Height - Position - Year - Country**" or variations
    // Can also be "Name - Position - Country" etc.
    if (line.includes('-') || line.includes('–')) {
      const isFeatured = line.includes('**');
      const cleanLine = line.replace(/\*\*/g, '').trim();
      const parts = cleanLine.split(/\s*[-–]\s*/).map((p) => p.trim()).filter(Boolean);

      if (parts.length >= 2) {
        // First part is the name
        const name = parts[0];

        // Look for position in parts
        let position = currentPosition;
        for (const part of parts) {
          const lowerPart = part.toLowerCase();
          if (lowerPart === 'setter' || lowerPart === 's') position = 'Setter';
          else if (lowerPart === 'outside hitter' || lowerPart === 'oh') position = 'Outside Hitter';
          else if (lowerPart === 'opposite' || lowerPart === 'opp') position = 'Opposite';
          else if (lowerPart === 'middle blocker' || lowerPart === 'mb' || lowerPart === 'middle') position = 'Middle Blocker';
          else if (lowerPart === 'libero' || lowerPart === 'l') position = 'Libero';
        }

        // Look for height
        let height = '';
        for (const part of parts) {
          const heightMatch = part.match(/(\d{3})\s*cm/i) || part.match(/(\d{2,3})\s*cm/i);
          if (heightMatch) {
            height = heightMatch[0].replace(/\s/g, '');
            break;
          }
        }

        // Look for year
        let birthYear: number | undefined;
        for (const part of parts) {
          const yearMatch = part.match(/^(19[89]\d|200\d|201\d|202\d)$/);
          if (yearMatch) {
            birthYear = parseInt(yearMatch[1]);
            break;
          }
        }

        // Look for nationality (last meaningful part usually)
        let nationality = '';
        for (const part of parts) {
          const cleanPart = part.replace(/\*\*/g, '').trim();
          for (const country of countries) {
            if (cleanPart.toLowerCase() === country.toLowerCase() ||
                cleanPart.toLowerCase().includes(country.toLowerCase())) {
              nationality = country;
              // Fix common misspellings
              if (nationality.toLowerCase() === 'ukrain') nationality = 'Ukraine';
              if (nationality.toLowerCase() === 'danmark') nationality = 'Denmark';
              break;
            }
          }
          if (nationality) break;
        }

        // Look for notes (left-handed, Japanese text, etc.)
        let notes = '';
        for (const part of parts) {
          if (part.toLowerCase().includes('left hand') || part.toLowerCase().includes('left-hand')) {
            notes = 'Left-handed';
          }
          // Check for Japanese characters
          if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(part)) {
            notes = notes ? `${notes}. ${part}` : part;
          }
        }

        // Only save if we have minimum required fields
        if (name && name.length > 1 && position && nationality) {
          // Save previous athlete if exists
          if (currentAthlete && currentAthlete.name && currentAthlete.position && currentAthlete.nationality) {
            athletes.push(currentAthlete as AthleteData);
          }

          currentAthlete = {
            name,
            position,
            height: height || undefined,
            nationality,
            birthYear,
            notes: notes || undefined,
            featured: isFeatured,
            highlightUrls: [],
          };
        }
      }
    }
  }

  // Don't forget the last athlete
  if (currentAthlete && currentAthlete.name && currentAthlete.position && currentAthlete.nationality) {
    athletes.push(currentAthlete as AthleteData);
  }

  return athletes;
}

interface AthleteData {
  name: string;
  position: string;
  height?: string;
  nationality: string;
  birthYear?: number;
  notes?: string;
  profileUrl?: string;
  highlightUrls?: string[];
  statsUrl?: string;
  featured?: boolean;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check file type
    const isDocx = file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isTxt = file.name.endsWith('.txt') || file.type === 'text/plain';

    if (!isDocx && !isTxt) {
      return NextResponse.json({ error: 'Please upload a .docx or .txt file' }, { status: 400 });
    }

    let text = '';

    if (isDocx) {
      // Parse DOCX with mammoth
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      text = result.value;
    } else {
      // Plain text file
      text = await file.text();
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 });
    }

    // Parse athletes from text
    // Try basic parser first (faster, free), fall back to LLM if it fails
    let parsedAthletes: AthleteData[] = parseAthletesBasic(text);
    console.log(`Basic parser found ${parsedAthletes.length} athletes`);

    // If basic parser found nothing and LLM is configured, try LLM as fallback
    if (parsedAthletes.length === 0 && isLLMConfigured()) {
      console.log('Basic parser found nothing, trying LLM...');
      try {
        parsedAthletes = await parseAthletesWithLLM(text);
        console.log(`LLM parser found ${parsedAthletes.length} athletes`);
      } catch (e) {
        console.error('LLM parsing also failed:', e);
      }
    }

    if (parsedAthletes.length === 0) {
      return NextResponse.json({
        error: 'Could not extract any athletes from the file. Please ensure the document contains player info with name, position, and nationality.',
      }, { status: 400 });
    }

    // Insert athletes into database
    const newAthletes = parsedAthletes.map((a) => ({
      id: uuid(),
      name: a.name,
      position: a.position,
      height: a.height || null,
      nationality: a.nationality,
      birthYear: a.birthYear || null,
      notes: a.notes || null,
      profileUrl: a.profileUrl || null,
      highlightUrls: a.highlightUrls || [],
      statsUrl: a.statsUrl || null,
      featured: a.featured || false,
      active: true,
    }));

    await db.insert(athletes).values(newAthletes);

    return NextResponse.json({
      imported: newAthletes.length,
      athletes: newAthletes.map((a) => ({ name: a.name, position: a.position, nationality: a.nationality })),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to import athletes:', error);
    return NextResponse.json({ error: 'Failed to import athletes' }, { status: 500 });
  }
}
