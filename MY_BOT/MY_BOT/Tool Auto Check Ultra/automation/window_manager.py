"""
Window Manager for browser positioning
Size: 300x300, Max 5 cols x 3 rows, start from left
"""
import logging
from typing import List, Tuple

try:
    from screeninfo import get_monitors
except ImportError:
    get_monitors = None

logger = logging.getLogger(__name__)

# Browser window size - larger for better content visibility
BROWSER_WIDTH = 400
BROWSER_HEIGHT = 500

# Grid layout
MAX_COLS = 5
MAX_ROWS = 3


class WindowManager:
    """Manages browser window positioning in a grid layout."""
    
    def __init__(self):
        self.screen_width = 1920
        self.screen_height = 1080
        
        # Get primary monitor size
        if get_monitors:
            try:
                monitors = get_monitors()
                for m in monitors:
                    if m.is_primary:
                        self.screen_width = m.width
                        self.screen_height = m.height
                        break
            except:
                pass
        
        logger.info(f"WindowManager: Screen {self.screen_width}x{self.screen_height}")
        logger.info(f"WindowManager: Browser {BROWSER_WIDTH}x{BROWSER_HEIGHT}, Grid {MAX_COLS}x{MAX_ROWS}")
    
    def calculate_grid(self, num_windows: int) -> Tuple[int, int]:
        """Calculate optimal grid dimensions."""
        if num_windows <= 0:
            return 1, 1
        
        # Limit to max 15 windows (5x3)
        num_windows = min(num_windows, MAX_COLS * MAX_ROWS)
        
        # Calculate columns (max 5)
        cols = min(num_windows, MAX_COLS)
        
        # Calculate rows needed
        rows = (num_windows + cols - 1) // cols
        rows = min(rows, MAX_ROWS)
        
        return cols, rows
    
    def get_window_positions(self, num_windows: int) -> List[Tuple[int, int, int, int]]:
        """
        Get positions for browser windows.
        Returns list of (x, y, width, height) tuples.
        Windows start from LEFT side.
        """
        # Limit to max 15 windows
        num_windows = min(num_windows, MAX_COLS * MAX_ROWS)
        
        cols, rows = self.calculate_grid(num_windows)
        
        # Start from LEFT (x=0)
        start_x = 0
        start_y = 0
        
        positions = []
        for i in range(num_windows):
            col = i % cols
            row = i // cols
            
            x = start_x + col * BROWSER_WIDTH
            y = start_y + row * BROWSER_HEIGHT
            
            # Ensure window stays on screen
            x = max(0, min(x, self.screen_width - BROWSER_WIDTH))
            y = max(0, min(y, self.screen_height - BROWSER_HEIGHT))
            
            positions.append((x, y, BROWSER_WIDTH, BROWSER_HEIGHT))
        
        logger.info(f"Grid: {cols}x{rows}, Size: {BROWSER_WIDTH}x{BROWSER_HEIGHT}")
        return positions
    
    def get_single_position(self, index: int, total: int) -> Tuple[int, int, int, int]:
        """Get position for a single window by index."""
        positions = self.get_window_positions(total)
        if 0 <= index < len(positions):
            return positions[index]
        return (0, 0, BROWSER_WIDTH, BROWSER_HEIGHT)
