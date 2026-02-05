#!/usr/bin/env python3
"""
Example Python skill script
This runs as a subprocess with environment variables
"""

import json
import os
import sys
from datetime import datetime

def main():
    # Get parameters from environment
    params_json = os.environ.get('SKILL_PARAMS', '{}')
    params = json.loads(params_json)
    artifact_dir = os.environ.get('SKILL_ARTIFACT_DIR', '/tmp')
    
    text = params.get('text', 'Default sample text for analysis')
    
    print(f"Starting Python skill execution...")
    print(f"Input text: {text}")
    print(f"Artifact directory: {artifact_dir}")
    
    # Perform simple text analysis
    words = text.split()
    word_count = len(words)
    char_count = len(text)
    unique_words = len(set(word.lower() for word in words))
    
    # Calculate word frequency
    word_freq = {}
    for word in words:
        word_lower = word.lower()
        word_freq[word_lower] = word_freq.get(word_lower, 0) + 1
    
    # Sort by frequency
    sorted_freq = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    
    # Create analysis report
    report = {
        'timestamp': datetime.now().isoformat(),
        'input_text': text,
        'analysis': {
            'word_count': word_count,
            'character_count': char_count,
            'unique_words': unique_words,
            'average_word_length': round(char_count / max(word_count, 1), 2),
        },
        'word_frequency': dict(sorted_freq[:10]),  # Top 10 words
        'environment': 'Python subprocess',
    }
    
    # Write artifact
    artifact_path = os.path.join(artifact_dir, 'analysis.json')
    with open(artifact_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nAnalysis Results:")
    print(f"  Word count: {word_count}")
    print(f"  Character count: {char_count}")
    print(f"  Unique words: {unique_words}")
    print(f"\nArtifact created: analysis.json")
    print("Python skill execution completed!")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
