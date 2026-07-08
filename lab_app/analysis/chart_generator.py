"""
Chart Generator for Lab Research Analysis

This module handles data visualization and chart generation for research data.
It integrates with the DataProcessor to create various types of charts
that can be displayed in the web UI or exported as images.
"""

import pandas as pd
import numpy as np
import json
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import base64
from io import BytesIO

# Try to import matplotlib, provide fallback if not available
try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False
    print("⚠️  matplotlib not available - chart generation disabled")


class ChartGenerator:
    """Generates various types of charts from research data."""
    
    def __init__(self, output_dir: str = "local_data_cache/charts"):
        """
        Initialize the chart generator.
        
        Args:
            output_dir: Directory to store generated chart images
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        if not MATPLOTLIB_AVAILABLE:
            print("⚠️  Chart generator initialized without matplotlib support")
        else:
            print(f"Chart generator initialized. Output: {self.output_dir.absolute()}")
    
    def _setup_chart_style(self) -> None:
        """Configure matplotlib chart styling."""
        if not MATPLOTLIB_AVAILABLE:
            return
            
        plt.style.use('seaborn-v0_8-darkgrid')
        plt.rcParams['figure.figsize'] = (12, 6)
        plt.rcParams['font.size'] = 10
        plt.rcParams['axes.labelsize'] = 12
        plt.rcParams['axes.titlesize'] = 14
        plt.rcParams['xtick.labelsize'] = 10
        plt.rcParams['ytick.labelsize'] = 10
    
    def _save_chart_as_base64(self, fig) -> str:
        """
        Save matplotlib figure as base64 encoded string.
        
        Args:
            fig: Matplotlib figure object
            
        Returns:
            Base64 encoded image string
        """
        if not MATPLOTLIB_AVAILABLE:
            return ""
            
        buffer = BytesIO()
        fig.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        plt.close(fig)
        return image_base64
    
    def _save_chart_as_file(self, fig, filename: str) -> str:
        """
        Save matplotlib figure as PNG file.
        
        Args:
            fig: Matplotlib figure object
            filename: Name for the output file
            
        Returns:
            Path to the saved file
        """
        if not MATPLOTLIB_AVAILABLE:
            return ""
            
        filepath = self.output_dir / f"{filename}.png"
        fig.savefig(filepath, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        return str(filepath)
    
    def generate_line_chart(self, df: pd.DataFrame, x_column: str, y_columns: List[str],
                           title: str = "Line Chart", return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a line chart for time series or sequential data.
        
        Args:
            df: Pandas DataFrame containing the data
            x_column: Column name for x-axis
            y_columns: List of column names for y-axis
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Plot each y column
        for y_col in y_columns:
            if y_col in df.columns:
                ax.plot(df[x_column], df[y_col], label=y_col, linewidth=2)
        
        ax.set_xlabel(x_column)
        ax.set_ylabel('Value')
        ax.set_title(title)
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # Format x-axis if it's datetime
        if pd.api.types.is_datetime64_any_dtype(df[x_column]):
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
            plt.xticks(rotation=45)
        
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = f"line_chart_{x_column}_{y_columns[0]}"
            return self._save_chart_as_file(fig, filename)
    
    def generate_bar_chart(self, df: pd.DataFrame, x_column: str, y_column: str,
                          title: str = "Bar Chart", return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a bar chart for categorical data.
        
        Args:
            df: Pandas DataFrame containing the data
            x_column: Column name for x-axis (categories)
            y_column: Column name for y-axis (values)
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        ax.bar(df[x_column], df[y_column], color='steelblue', alpha=0.8)
        ax.set_xlabel(x_column)
        ax.set_ylabel(y_column)
        ax.set_title(title)
        ax.grid(True, alpha=0.3, axis='y')
        
        # Rotate x-axis labels if there are many categories
        if len(df) > 10:
            plt.xticks(rotation=45, ha='right')
        
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = f"bar_chart_{x_column}_{y_column}"
            return self._save_chart_as_file(fig, filename)
    
    def generate_scatter_plot(self, df: pd.DataFrame, x_column: str, y_column: str,
                             color_column: Optional[str] = None,
                             title: str = "Scatter Plot", return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a scatter plot for correlation analysis.
        
        Args:
            df: Pandas DataFrame containing the data
            x_column: Column name for x-axis
            y_column: Column name for y-axis
            color_column: Optional column name for color coding
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        fig, ax = plt.subplots(figsize=(10, 8))
        
        if color_column and color_column in df.columns:
            scatter = ax.scatter(df[x_column], df[y_column], c=df[color_column], 
                                cmap='viridis', alpha=0.6, s=50)
            plt.colorbar(scatter, ax=ax, label=color_column)
        else:
            ax.scatter(df[x_column], df[y_column], alpha=0.6, s=50)
        
        ax.set_xlabel(x_column)
        ax.set_ylabel(y_column)
        ax.set_title(title)
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = f"scatter_plot_{x_column}_{y_column}"
            return self._save_chart_as_file(fig, filename)
    
    def generate_histogram(self, df: pd.DataFrame, column: str, bins: int = 30,
                          title: str = "Histogram", return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a histogram for distribution analysis.
        
        Args:
            df: Pandas DataFrame containing the data
            column: Column name to plot
            bins: Number of histogram bins
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        ax.hist(df[column].dropna(), bins=bins, color='steelblue', alpha=0.7, edgecolor='black')
        ax.set_xlabel(column)
        ax.set_ylabel('Frequency')
        ax.set_title(title)
        ax.grid(True, alpha=0.3, axis='y')
        
        # Add statistics text
        mean_val = df[column].mean()
        std_val = df[column].std()
        ax.axvline(mean_val, color='red', linestyle='--', linewidth=2, label=f'Mean: {mean_val:.2f}')
        ax.legend()
        
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = f"histogram_{column}"
            return self._save_chart_as_file(fig, filename)
    
    def generate_box_plot(self, df: pd.DataFrame, columns: List[str],
                         title: str = "Box Plot", return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a box plot for statistical comparison.
        
        Args:
            df: Pandas DataFrame containing the data
            columns: List of column names to plot
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Filter to only numeric columns that exist
        numeric_columns = [col for col in columns if col in df.columns and pd.api.types.is_numeric_dtype(df[col])]
        
        if not numeric_columns:
            return {"error": "No numeric columns found"}
        
        box_data = [df[col].dropna() for col in numeric_columns]
        ax.boxplot(box_data, labels=numeric_columns)
        ax.set_ylabel('Value')
        ax.set_title(title)
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = f"box_plot_{'_'.join(numeric_columns[:2])}"
            return self._save_chart_as_file(fig, filename)
    
    def generate_correlation_heatmap(self, df: pd.DataFrame, title: str = "Correlation Heatmap",
                                    return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a correlation heatmap for numeric columns.
        
        Args:
            df: Pandas DataFrame containing the data
            title: Chart title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        # Calculate correlation matrix for numeric columns only
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty or len(numeric_df.columns) < 2:
            return {"error": "Not enough numeric columns for correlation"}
        
        correlation_matrix = numeric_df.corr()
        
        fig, ax = plt.subplots(figsize=(10, 8))
        
        im = ax.imshow(correlation_matrix, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)
        
        # Add colorbar
        plt.colorbar(im, ax=ax)
        
        # Set ticks and labels
        ax.set_xticks(np.arange(len(correlation_matrix.columns)))
        ax.set_yticks(np.arange(len(correlation_matrix.columns)))
        ax.set_xticklabels(correlation_matrix.columns, rotation=45, ha='right')
        ax.set_yticklabels(correlation_matrix.columns)
        
        # Add correlation values as text
        for i in range(len(correlation_matrix.columns)):
            for j in range(len(correlation_matrix.columns)):
                text = ax.text(j, i, f'{correlation_matrix.iloc[i, j]:.2f}',
                             ha="center", va="center", color="black", fontsize=8)
        
        ax.set_title(title)
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = "correlation_heatmap"
            return self._save_chart_as_file(fig, filename)
    
    def generate_dashboard(self, df: pd.DataFrame, title: str = "Data Dashboard",
                         return_base64: bool = True) -> Union[str, Dict[str, Any]]:
        """
        Generate a comprehensive dashboard with multiple charts.
        
        Args:
            df: Pandas DataFrame containing the data
            title: Dashboard title
            return_base64: If True, return base64 string; if False, return file path
            
        Returns:
            Base64 encoded image string or file path
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available"}
            
        self._setup_chart_style()
        
        # Get numeric columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns.tolist()
        
        if len(numeric_columns) < 2:
            return {"error": "Not enough numeric columns for dashboard"}
        
        # Create a 2x2 subplot
        fig, axes = plt.subplots(2, 2, figsize=(16, 12))
        fig.suptitle(title, fontsize=16)
        
        # 1. Line chart (first numeric column vs index)
        axes[0, 0].plot(df.index, df[numeric_columns[0]], linewidth=2, color='steelblue')
        axes[0, 0].set_title(f'{numeric_columns[0]} Over Time')
        axes[0, 0].set_xlabel('Index')
        axes[0, 0].set_ylabel(numeric_columns[0])
        axes[0, 0].grid(True, alpha=0.3)
        
        # 2. Histogram (first numeric column)
        axes[0, 1].hist(df[numeric_columns[0]].dropna(), bins=30, color='steelblue', alpha=0.7, edgecolor='black')
        axes[0, 1].set_title(f'Distribution of {numeric_columns[0]}')
        axes[0, 1].set_xlabel(numeric_columns[0])
        axes[0, 1].set_ylabel('Frequency')
        axes[0, 1].grid(True, alpha=0.3, axis='y')
        
        # 3. Scatter plot (first two numeric columns)
        if len(numeric_columns) >= 2:
            axes[1, 0].scatter(df[numeric_columns[0]], df[numeric_columns[1]], alpha=0.6, s=50)
            axes[1, 0].set_title(f'{numeric_columns[0]} vs {numeric_columns[1]}')
            axes[1, 0].set_xlabel(numeric_columns[0])
            axes[1, 0].set_ylabel(numeric_columns[1])
            axes[1, 0].grid(True, alpha=0.3)
        
        # 4. Box plot (first few numeric columns)
        box_columns = numeric_columns[:min(5, len(numeric_columns))]
        box_data = [df[col].dropna() for col in box_columns]
        axes[1, 1].boxplot(box_data, labels=box_columns)
        axes[1, 1].set_title('Statistical Comparison')
        axes[1, 1].set_ylabel('Value')
        axes[1, 1].grid(True, alpha=0.3, axis='y')
        axes[1, 1].tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        
        if return_base64:
            return self._save_chart_as_base64(fig)
        else:
            filename = "dashboard"
            return self._save_chart_as_file(fig, filename)
    
    def get_chart_data_for_web(self, df: pd.DataFrame, chart_type: str, **kwargs) -> Dict[str, Any]:
        """
        Generate chart data in JSON format for web display.
        
        Args:
            df: Pandas DataFrame containing the data
            chart_type: Type of chart ('line', 'bar', 'scatter', 'histogram', 'box', 'heatmap', 'dashboard')
            **kwargs: Additional arguments specific to chart type
            
        Returns:
            Dictionary containing chart data and metadata
        """
        if not MATPLOTLIB_AVAILABLE:
            return {"error": "matplotlib not available", "success": False}
        
        try:
            # Generate chart based on type
            if chart_type == 'line':
                chart_data = self.generate_line_chart(df, return_base64=True, **kwargs)
            elif chart_type == 'bar':
                chart_data = self.generate_bar_chart(df, return_base64=True, **kwargs)
            elif chart_type == 'scatter':
                chart_data = self.generate_scatter_plot(df, return_base64=True, **kwargs)
            elif chart_type == 'histogram':
                chart_data = self.generate_histogram(df, return_base64=True, **kwargs)
            elif chart_type == 'box':
                chart_data = self.generate_box_plot(df, return_base64=True, **kwargs)
            elif chart_type == 'heatmap':
                chart_data = self.generate_correlation_heatmap(df, return_base64=True, **kwargs)
            elif chart_type == 'dashboard':
                chart_data = self.generate_dashboard(df, return_base64=True, **kwargs)
            else:
                return {"error": f"Unknown chart type: {chart_type}", "success": False}
            
            return {
                "success": True,
                "chart_type": chart_type,
                "image_data": chart_data,
                "format": "base64_png"
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "success": False,
                "chart_type": chart_type
            }


# Convenience function for quick chart generation
def generate_chart(df: pd.DataFrame, chart_type: str, **kwargs) -> Dict[str, Any]:
    """
    Quick function to generate a chart from a DataFrame.
    
    Args:
        df: Pandas DataFrame containing the data
        chart_type: Type of chart to generate
        **kwargs: Additional arguments for the specific chart type
        
    Returns:
        Dictionary containing chart data and metadata
    """
    generator = ChartGenerator()
    return generator.get_chart_data_for_web(df, chart_type, **kwargs)


if __name__ == "__main__":
    # Test the chart generator
    print("=== Testing Chart Generator ===\n")
    
    # Create sample data
    np.random.seed(42)
    data = {
        'timestamp': pd.date_range('2024-01-01', periods=100, freq='1min'),
        'sensor_1': np.random.normal(25, 2, 100),
        'sensor_2': np.random.normal(100, 10, 100),
        'sensor_3': np.random.normal(50, 5, 100),
        'temperature': np.random.normal(22, 1, 100),
        'humidity': np.random.normal(45, 5, 100)
    }
    df = pd.DataFrame(data)
    
    if MATPLOTLIB_AVAILABLE:
        try:
            # Test different chart types
            print("Testing line chart...")
            line_result = generate_chart(df, 'line', x_column='timestamp', 
                                       y_columns=['sensor_1', 'sensor_2'],
                                       title='Sensor Data Over Time')
            print(f"   Line chart: {'Success' if line_result['success'] else 'Failed'}")
            
            print("\nTesting histogram...")
            hist_result = generate_chart(df, 'histogram', column='sensor_1',
                                        title='Sensor 1 Distribution')
            print(f"   Histogram: {'Success' if hist_result['success'] else 'Failed'}")
            
            print("\nTesting scatter plot...")
            scatter_result = generate_chart(df, 'scatter', x_column='sensor_1',
                                          y_column='sensor_2', title='Sensor Correlation')
            print(f"   Scatter plot: {'Success' if scatter_result['success'] else 'Failed'}")
            
            print("\nTesting dashboard...")
            dashboard_result = generate_chart(df, 'dashboard', title='Sensor Dashboard')
            print(f"   Dashboard: {'Success' if dashboard_result['success'] else 'Failed'}")
            
            print("\n[OK] All chart tests completed successfully!")
            
        except Exception as e:
            print(f"Test failed: {e}")
    else:
        print("⚠️  Skipping tests - matplotlib not available")
        print("   Install with: pip install matplotlib")
