#!/usr/bin/env python3
"""
Simple script to generate placeholder icons for the Chrome extension.
Requires PIL/Pillow: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import os
except ImportError:
    print("PIL/Pillow not installed. Install with: pip install Pillow")
    print("Or create icons manually at sizes 16x16, 48x48, and 128x128 pixels")
    exit(1)

def create_icon(size, filename):
    """Create a simple WiFi icon"""
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Colors
    bg_color = (76, 175, 80, 255)  # Green
    icon_color = (255, 255, 255, 255)  # White
    
    # Draw background circle
    margin = size // 8
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color)
    
    # Draw WiFi symbol (simplified)
    center_x, center_y = size // 2, size // 2
    radius_step = size // 6
    
    # Draw three arcs
    for i in range(3):
        radius = radius_step * (i + 1)
        box = [
            center_x - radius,
            center_y - radius + radius_step,
            center_x + radius,
            center_y + radius + radius_step
        ]
        draw.arc(box, start=45, end=135, fill=icon_color, width=max(1, size // 32))
    
    # Draw center dot
    dot_size = max(1, size // 16)
    draw.ellipse([
        center_x - dot_size,
        center_y + radius_step * 2 - dot_size,
        center_x + dot_size,
        center_y + radius_step * 2 + dot_size
    ], fill=icon_color)
    
    # Save
    img.save(filename, 'PNG')
    print(f"Created {filename} ({size}x{size})")

def main():
    icon_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(icon_dir, exist_ok=True)
    
    sizes = [16, 48, 128]
    for size in sizes:
        filename = os.path.join(icon_dir, f'icon{size}.png')
        create_icon(size, filename)
    
    print("\nIcons created successfully!")

if __name__ == '__main__':
    main()



