"""
Main Application Entry Point for Lab Inventory & Research Logs

This module creates the Flet application with a sidebar navigation and
offline/online status indicator. It provides the main UI framework for
the lab inventory and research analysis application.
"""

import flet as ft
import sys
import os
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase
from analysis.data_processor import DataProcessor
from voice.listener import VoiceListener
from ui.project_view import ProjectView
from dashboard.lab_dashboard import LabDashboard
from knowledge.knowledge_vault import KnowledgeVault
from notebook.engineering_notebook import EngineeringNotebook
from inventory.component_manager import ComponentManager
from equipment.equipment_manager import EquipmentManager
from findings.findings_manager import FindingsManager
from toolbox.engineering_toolbox import EngineeringToolbox
from search.semantic_search import SemanticSearch


class LabApp:
    """Main application class for the Lab Inventory & Research Logs app."""
    
    def __init__(self, page: ft.Page):
        """
        Initialize the application.
        
        Args:
            page: Flet page object
        """
        self.page = page
        self.current_view = "inventory"
        self.is_online = True  # Simulated online status
        self.voice_enabled = False  # Voice assistant state
        
        # Initialize database and data processor
        try:
            self.db = CacheDatabase()
            self.processor = DataProcessor()
            print("✅ Database and processor initialized")
        except Exception as e:
            print(f"❌ Initialization error: {e}")
            self.db = None
            self.processor = None
        
        # Initialize voice listener (will be started later)
        self.voice_listener: Optional[VoiceListener] = None
        
        # Initialize project view
        self.project_view: Optional[ProjectView] = None
        
        # Initialize Phase 4 modules
        try:
            self.dashboard = LabDashboard(db=self.db)
            self.knowledge_vault = KnowledgeVault(db=self.db)
            self.notebook = EngineeringNotebook(db=self.db)
            self.component_manager = ComponentManager(db=self.db)
            self.equipment_manager = EquipmentManager(db=self.db)
            self.findings_manager = FindingsManager(db=self.db)
            self.toolbox = EngineeringToolbox(db=self.db)
            self.semantic_search = SemanticSearch(db=self.db)
            print("✅ Phase 4 modules initialized")
        except Exception as e:
            print(f"❌ Phase 4 modules initialization error: {e}")
            self.dashboard = None
            self.knowledge_vault = None
            self.notebook = None
            self.component_manager = None
            self.equipment_manager = None
            self.findings_manager = None
            self.toolbox = None
            self.semantic_search = None
        
        # Setup UI
        self._setup_page()
        self._build_ui()
        
        # Register cleanup on page close
        self.page.on_close = self._on_app_close
    
    def _setup_page(self) -> None:
        """Configure the Flet page settings."""
        self.page.title = "Lab Inventory & Research Logs"
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self.page.window_width = 1200
        self.page.window_height = 800
        self.page.window_min_width = 800
        self.page.window_min_height = 600
        self.page.padding = 0
        self.page.bgcolor = ft.Colors.GREY_50
    
    def _build_ui(self) -> None:
        """Build the main UI structure."""
        # Create sidebar
        self.sidebar = self._create_sidebar()
        
        # Create content area
        self.content_area = ft.Container(
            content=self._create_inventory_view(),
            expand=True,
            bgcolor=ft.Colors.WHITE,
            padding=20
        )
        
        # Create status bar
        self.status_bar = self._create_status_bar()
        
        # Main layout
        self.page.add(
            ft.Column(
                [
                    self.status_bar,
                    ft.Row(
                        [
                            self.sidebar,
                            ft.VerticalDivider(width=1),
                            self.content_area
                        ],
                        expand=True
                    )
                ],
                expand=True
            )
        )
    
    def _create_status_bar(self) -> ft.Container:
        """
        Create the status bar with offline/online indicator.
        
        Returns:
            Container with status bar UI
        """
        self.status_icon = ft.Text(
            "✓",
            color=ft.Colors.GREEN_600,
            size=20
        )
        
        self.status_text = ft.Text(
            "Online",
            color=ft.Colors.GREEN_600,
            size=12,
            weight=ft.FontWeight.BOLD
        )
        
        # Voice status indicator
        self.voice_status_icon = ft.Text(
            "🎤",
            color=ft.Colors.GREY_400,
            size=18
        )
        
        self.voice_status_text = ft.Text(
            "Voice: Off",
            color=ft.Colors.GREY_500,
            size=11
        )
        
        status_bar = ft.Container(
            content=ft.Row(
                [
                    self.status_icon,
                    self.status_text,
                    ft.Container(width=20),
                    ft.VerticalDivider(width=1, color=ft.Colors.BLUE_GREY_200),
                    ft.Container(width=10),
                    self.voice_status_icon,
                    self.voice_status_text,
                    ft.Container(expand=True),  # Spacer
                    ft.Text(
                        "Lab Inventory & Research Logs",
                        color=ft.Colors.BLUE_GREY_700,
                        size=14,
                        weight=ft.FontWeight.W_500
                    )
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                vertical_alignment=ft.CrossAxisAlignment.CENTER
            ),
            bgcolor=ft.Colors.BLUE_GREY_50,
            padding=20,
            border_radius=0
        )
        
        return status_bar
    
    def _create_sidebar(self) -> ft.Container:
        """
        Create the sidebar navigation.
        
        Returns:
            Container with sidebar UI
        """
        # Navigation buttons
        self.inventory_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("★", size=20),
                    ft.Text("Inventory", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.BLUE_600,
            color=ft.Colors.WHITE,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_inventory
        )
        
        self.analysis_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("📊", size=20),
                    ft.Text("R&D Analysis", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_analysis
        )
        
        self.projects_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("📁", size=20),
                    ft.Text("Projects", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_projects
        )
        
        # Phase 4 navigation buttons
        self.dashboard_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("📊", size=20),
                    ft.Text("Dashboard", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_dashboard
        )
        
        self.knowledge_vault_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("📚", size=20),
                    ft.Text("Knowledge Vault", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_knowledge_vault
        )
        
        self.notebook_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("📓", size=20),
                    ft.Text("Notebook", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_notebook
        )
        
        self.components_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("🔧", size=20),
                    ft.Text("Components", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_components
        )
        
        self.equipment_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("⚙️", size=20),
                    ft.Text("Equipment", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_equipment
        )
        
        self.findings_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("💡", size=20),
                    ft.Text("Findings", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_findings
        )
        
        self.toolbox_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("🧮", size=20),
                    ft.Text("Toolbox", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_toolbox
        )
        
        self.search_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("🔍", size=20),
                    ft.Text("AI Search", size=14)
                ],
                spacing=10
            ),
            bgcolor=ft.Colors.TRANSPARENT,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=20
            ),
            width=200,
            on_click=self._navigate_to_search
        )
        
        # Toggle online/offline button
        self.toggle_connection_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("🔄", size=16),
                    ft.Text("Toggle Connection", size=12)
                ],
                spacing=8
            ),
            bgcolor=ft.Colors.BLUE_GREY_100,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=15
            ),
            width=200,
            on_click=self._toggle_connection
        )
        
        # Toggle voice assistant button
        self.toggle_voice_btn = ft.ElevatedButton(
            content=ft.Row(
                [
                    ft.Text("🎤", size=16),
                    ft.Text("Enable Voice", size=12)
                ],
                spacing=8
            ),
            bgcolor=ft.Colors.BLUE_GREY_100,
            color=ft.Colors.BLUE_GREY_700,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=8),
                padding=15
            ),
            width=200,
            on_click=self._toggle_voice
        )
        
        sidebar = ft.Container(
            content=ft.Column(
                [
                    ft.Container(
                        content=ft.Column(
                            [
                                ft.Text(
                                    "🔬",
                                    size=40,
                                    color=ft.Colors.BLUE_600
                                ),
                                ft.Text(
                                    "Lab Manager",
                                    size=18,
                                    weight=ft.FontWeight.BOLD,
                                    color=ft.Colors.BLUE_GREY_800
                                ),
                                ft.Divider(height=20, color=ft.Colors.TRANSPARENT),
                            ],
                            horizontal_alignment=ft.CrossAxisAlignment.CENTER
                        ),
                        padding=20
                    ),
                    ft.Divider(height=1, color=ft.Colors.BLUE_GREY_200),
                    ft.Container(
                        content=ft.Column(
                            [
                                self.inventory_btn,
                                ft.Container(height=10),
                                self.analysis_btn,
                                ft.Container(height=10),
                                self.projects_btn,
                                ft.Container(height=10),
                                ft.Divider(height=1, color=ft.Colors.BLUE_GREY_200),
                                ft.Container(height=10),
                                ft.Text("Phase 4", size=12, color=ft.Colors.BLUE_GREY_500, weight=ft.FontWeight.BOLD),
                                ft.Container(height=10),
                                self.dashboard_btn,
                                ft.Container(height=10),
                                self.knowledge_vault_btn,
                                ft.Container(height=10),
                                self.notebook_btn,
                                ft.Container(height=10),
                                self.components_btn,
                                ft.Container(height=10),
                                self.equipment_btn,
                                ft.Container(height=10),
                                self.findings_btn,
                                ft.Container(height=10),
                                self.toolbox_btn,
                                ft.Container(height=10),
                                self.search_btn,
                            ],
                            spacing=0
                        ),
                        padding=20
                    ),
                    ft.Container(expand=True),  # Spacer
                    ft.Divider(height=1, color=ft.Colors.BLUE_GREY_200),
                    ft.Container(
                        content=ft.Column(
                            [
                                self.toggle_voice_btn,
                                ft.Container(height=10),
                                self.toggle_connection_btn,
                            ],
                            spacing=0
                        ),
                        padding=20
                    )
                ],
                spacing=0
            ),
            width=250,
            bgcolor=ft.Colors.WHITE,
            border_radius=0
        )
        
        return sidebar
    
    def _create_inventory_view(self) -> ft.Column:
        """
        Create the inventory view.
        
        Returns:
            Column with inventory UI
        """
        header = ft.Row(
            [
                ft.Text("★", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Equipment Inventory",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        # Sample equipment table
        equipment_table = ft.DataTable(
            columns=[
                ft.DataColumn(ft.Text("ID", weight=ft.FontWeight.BOLD)),
                ft.DataColumn(ft.Text("Name", weight=ft.FontWeight.BOLD)),
                ft.DataColumn(ft.Text("Model", weight=ft.FontWeight.BOLD)),
                ft.DataColumn(ft.Text("Status", weight=ft.FontWeight.BOLD)),
                ft.DataColumn(ft.Text("Calibration", weight=ft.FontWeight.BOLD)),
            ],
            rows=[
                ft.DataRow(
                    cells=[
                        ft.DataCell(ft.Text("1")),
                        ft.DataCell(ft.Text("Spectrometer")),
                        ft.DataCell(ft.Text("Model X-100")),
                        ft.DataCell(
                            ft.Container(
                                content=ft.Text("Available", size=12),
                                bgcolor=ft.Colors.GREEN_100,
                                padding=10,
                                border_radius=10
                            )
                        ),
                        ft.DataCell(ft.Text("2024-01-15")),
                    ]
                ),
                ft.DataRow(
                    cells=[
                        ft.DataCell(ft.Text("2")),
                        ft.DataCell(ft.Text("Centrifuge")),
                        ft.DataCell(ft.Text("SpinMaster 5000")),
                        ft.DataCell(
                            ft.Container(
                                content=ft.Text("In Use", size=12),
                                bgcolor=ft.Colors.ORANGE_100,
                                padding=10,
                                border_radius=10
                            )
                        ),
                        ft.DataCell(ft.Text("2024-02-20")),
                    ]
                ),
            ],
            border_radius=8,
            horizontal_lines=ft.BorderSide(1, ft.Colors.BLUE_GREY_100),
            data_row_color=ft.Colors.TRANSPARENT,
            heading_row_color=ft.Colors.BLUE_GREY_50,
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Equipment List",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                equipment_table,
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_analysis_view(self) -> ft.Column:
        """
        Create the R&D analysis view.
        
        Returns:
            Column with analysis UI
        """
        header = ft.Row(
            [
                ft.Text("📊", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "R&D Data Analysis",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        # Sample log entries
        log_card = ft.Card(
            content=ft.Container(
                content=ft.Column(
                    [
                        ft.Row(
                            [
                                ft.Text(
                                    "Sensor Calibration",
                                    size=16,
                                    weight=ft.FontWeight.BOLD,
                                    color=ft.Colors.BLUE_GREY_800
                                ),
                                ft.Container(expand=True),
                                ft.Text(
                                    "⬇",
                                    size=20,
                                    color=ft.Colors.BLUE_600
                                ),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                        ),
                        ft.Container(height=10),
                        ft.Text(
                            "Initial calibration run - Performed baseline calibration on all sensors.",
                            size=14,
                            color=ft.Colors.BLUE_GREY_600
                        ),
                        ft.Container(height=10),
                        ft.Row(
                            [
                                ft.Text(
                                    "📊 sensor_data.csv",
                                    size=12,
                                    color=ft.Colors.BLUE_600,
                                    style=ft.TextStyle(decoration=ft.TextDecoration.UNDERLINE)
                                ),
                                ft.Container(width=10),
                                ft.Text(
                                    "• Not downloaded locally",
                                    size=12,
                                    color=ft.Colors.ORANGE_600
                                )
                            ]
                        )
                    ],
                    spacing=0
                ),
                padding=20
            ),
            elevation=2
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Recent Research Logs",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                log_card,
                ft.Container(height=20),
                ft.ElevatedButton(
                    "Load Data for Analysis",
                    icon="▶",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    style=ft.ButtonStyle(
                        shape=ft.RoundedRectangleBorder(radius=8),
                        padding=30
                    ),
                    on_click=self._load_sample_data
                )
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_projects_view(self) -> ft.Column:
        """
        Create the projects view.
        
        Returns:
            Column with projects UI
        """
        # Initialize project view if not already done
        if self.project_view is None and self.db:
            self.project_view = ProjectView(
                page=self.page,
                db=self.db,
                on_project_selected=self._on_project_selected
            )
        
        if self.project_view:
            return self.project_view.build()
        else:
            # Fallback if database not available
            return ft.Column(
                [
                    ft.Text("⚠", size=48, color=ft.Colors.RED_600),
                    ft.Container(height=20),
                    ft.Text(
                        "Database not available",
                        size=16,
                        color=ft.Colors.RED_600
                    )
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER
            )
    
    def _on_project_selected(self, project: Dict[str, Any]) -> None:
        """
        Handle project selection callback.
        
        Args:
            project: Selected project dictionary
        """
        print(f"📂 Project selected: {project['name']}")
        # Can add additional logic here, like updating other UI elements
    
    def _navigate_to_inventory(self, e) -> None:
        """Navigate to inventory view."""
        self.current_view = "inventory"
        
        # Update button styles
        self.inventory_btn.bgcolor = ft.Colors.BLUE_600
        self.inventory_btn.color = ft.Colors.WHITE
        self.analysis_btn.bgcolor = ft.Colors.TRANSPARENT
        self.analysis_btn.color = ft.Colors.BLUE_GREY_700
        self.projects_btn.bgcolor = ft.Colors.TRANSPARENT
        self.projects_btn.color = ft.Colors.BLUE_GREY_700
        
        # Update content
        self.content_area.content = self._create_inventory_view()
        self.page.update()
    
    def _navigate_to_analysis(self, e) -> None:
        """Navigate to analysis view."""
        self.current_view = "analysis"
        
        # Update button styles
        self.analysis_btn.bgcolor = ft.Colors.BLUE_600
        self.analysis_btn.color = ft.Colors.WHITE
        self.inventory_btn.bgcolor = ft.Colors.TRANSPARENT
        self.inventory_btn.color = ft.Colors.BLUE_GREY_700
        self.projects_btn.bgcolor = ft.Colors.TRANSPARENT
        self.projects_btn.color = ft.Colors.BLUE_GREY_700
        
        # Update content
        self.content_area.content = self._create_analysis_view()
        self.page.update()
    
    def _navigate_to_projects(self, e) -> None:
        """Navigate to projects view."""
        self.current_view = "projects"
        
        # Update button styles
        self._reset_all_button_styles()
        self.projects_btn.bgcolor = ft.Colors.BLUE_600
        self.projects_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_projects_view()
        self.page.update()
    
    def _navigate_to_dashboard(self, e) -> None:
        """Navigate to dashboard view."""
        self.current_view = "dashboard"
        
        # Update button styles
        self._reset_all_button_styles()
        self.dashboard_btn.bgcolor = ft.Colors.BLUE_600
        self.dashboard_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_dashboard_view()
        self.page.update()
    
    def _navigate_to_knowledge_vault(self, e) -> None:
        """Navigate to knowledge vault view."""
        self.current_view = "knowledge_vault"
        
        # Update button styles
        self._reset_all_button_styles()
        self.knowledge_vault_btn.bgcolor = ft.Colors.BLUE_600
        self.knowledge_vault_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_knowledge_vault_view()
        self.page.update()
    
    def _navigate_to_notebook(self, e) -> None:
        """Navigate to notebook view."""
        self.current_view = "notebook"
        
        # Update button styles
        self._reset_all_button_styles()
        self.notebook_btn.bgcolor = ft.Colors.BLUE_600
        self.notebook_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_notebook_view()
        self.page.update()
    
    def _navigate_to_components(self, e) -> None:
        """Navigate to components view."""
        self.current_view = "components"
        
        # Update button styles
        self._reset_all_button_styles()
        self.components_btn.bgcolor = ft.Colors.BLUE_600
        self.components_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_components_view()
        self.page.update()
    
    def _navigate_to_equipment(self, e) -> None:
        """Navigate to equipment view."""
        self.current_view = "equipment"
        
        # Update button styles
        self._reset_all_button_styles()
        self.equipment_btn.bgcolor = ft.Colors.BLUE_600
        self.equipment_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_equipment_view()
        self.page.update()
    
    def _navigate_to_findings(self, e) -> None:
        """Navigate to findings view."""
        self.current_view = "findings"
        
        # Update button styles
        self._reset_all_button_styles()
        self.findings_btn.bgcolor = ft.Colors.BLUE_600
        self.findings_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_findings_view()
        self.page.update()
    
    def _navigate_to_toolbox(self, e) -> None:
        """Navigate to toolbox view."""
        self.current_view = "toolbox"
        
        # Update button styles
        self._reset_all_button_styles()
        self.toolbox_btn.bgcolor = ft.Colors.BLUE_600
        self.toolbox_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_toolbox_view()
        self.page.update()
    
    def _navigate_to_search(self, e) -> None:
        """Navigate to AI search view."""
        self.current_view = "search"
        
        # Update button styles
        self._reset_all_button_styles()
        self.search_btn.bgcolor = ft.Colors.BLUE_600
        self.search_btn.color = ft.Colors.WHITE
        
        # Update content
        self.content_area.content = self._create_search_view()
        self.page.update()
    
    def _reset_all_button_styles(self) -> None:
        """Reset all navigation button styles to default."""
        buttons = [
            self.inventory_btn, self.analysis_btn, self.projects_btn,
            self.dashboard_btn, self.knowledge_vault_btn, self.notebook_btn,
            self.components_btn, self.equipment_btn, self.findings_btn,
            self.toolbox_btn, self.search_btn
        ]
        for btn in buttons:
            btn.bgcolor = ft.Colors.TRANSPARENT
            btn.color = ft.Colors.BLUE_GREY_700
    
    def _toggle_connection(self, e) -> None:
        """Toggle between online and offline mode."""
        self.is_online = not self.is_online
        
        if self.is_online:
            self.status_icon.value = "✓"
            self.status_icon.color = ft.Colors.GREEN_600
            self.status_text.value = "Online"
            self.status_text.color = ft.Colors.GREEN_600
            print("🌐 Switched to Online mode")
        else:
            self.status_icon.value = "☁"
            self.status_icon.color = ft.Colors.ORANGE_600
            self.status_text.value = "Offline (Cached)"
            self.status_text.color = ft.Colors.ORANGE_600
            print("📴 Switched to Offline (Cached) mode")
        
        self.page.update()
    
    def _toggle_voice(self, e) -> None:
        """Toggle voice assistant on/off."""
        self.voice_enabled = not self.voice_enabled
        
        if self.voice_enabled:
            # Start voice listener
            try:
                self.voice_listener = VoiceListener(
                    wake_word="jarvis",
                    db_path="local_cache.db",
                    on_command_processed=self._on_voice_command_processed
                )
                
                if self.voice_listener.start():
                    self.voice_status_icon.value = "🎙"
                    self.voice_status_icon.color = ft.Colors.BLUE_600
                    self.voice_status_text.value = "Voice: On"
                    self.voice_status_text.color = ft.Colors.BLUE_600
                    
                    self.toggle_voice_btn.content.controls[0].value = "🎙"
                    self.toggle_voice_btn.content.controls[1].value = "Disable Voice"
                    self.toggle_voice_btn.bgcolor = ft.Colors.BLUE_600
                    self.toggle_voice_btn.color = ft.Colors.WHITE
                    
                    print("🎙️  Voice assistant enabled")
                    self.page.snack_bar = ft.SnackBar(
                        content=ft.Text("Voice assistant enabled. Say 'Jarvis' to activate."),
                        bgcolor=ft.Colors.BLUE_600
                    )
                    self.page.snack_bar.open = True
                else:
                    self.voice_enabled = False
                    self.page.snack_bar = ft.SnackBar(
                        content=ft.Text("Failed to enable voice assistant. Check microphone permissions."),
                        bgcolor=ft.Colors.RED_600
                    )
                    self.page.snack_bar.open = True
            except Exception as ex:
                print(f"❌ Error starting voice listener: {ex}")
                self.voice_enabled = False
                self.page.snack_bar = ft.SnackBar(
                    content=ft.Text(f"Error: {str(ex)}"),
                    bgcolor=ft.Colors.RED_600
                )
                self.page.snack_bar.open = True
        else:
            # Stop voice listener
            if self.voice_listener:
                self.voice_listener.stop()
                self.voice_listener = None
            
            self.voice_status_icon.value = "🎤"
            self.voice_status_icon.color = ft.Colors.GREY_400
            self.voice_status_text.value = "Voice: Off"
            self.voice_status_text.color = ft.Colors.GREY_500
            
            self.toggle_voice_btn.content.controls[0].value = "🎤"
            self.toggle_voice_btn.content.controls[1].value = "Enable Voice"
            self.toggle_voice_btn.bgcolor = ft.Colors.BLUE_GREY_100
            self.toggle_voice_btn.color = ft.Colors.BLUE_GREY_700
            
            print("🔇 Voice assistant disabled")
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text("Voice assistant disabled."),
                bgcolor=ft.Colors.BLUE_GREY_600
            )
            self.page.snack_bar.open = True
        
        self.page.update()
    
    def _on_voice_command_processed(self, command_text: str) -> None:
        """
        Callback when a voice command is processed.
        
        Args:
            command_text: The command that was processed
        """
        print(f"📝 Voice command processed: {command_text}")
        # You can update the UI here if needed
        # For example, show a notification or update a log display
    
    # Phase 4 View Methods
    
    def _create_dashboard_view(self) -> ft.Column:
        """Create the dashboard view with Phase 4 features."""
        if not self.dashboard:
            return self._create_error_view("Dashboard not available")
        
        header = ft.Row(
            [
                ft.Text("📊", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Lab Dashboard",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        try:
            data = self.dashboard.get_dashboard_data()
            
            # Summary cards
            summary_cards = ft.Row(
                [
                    self._create_summary_card("Active Projects", str(data['active_projects']['total_active']), ft.Colors.BLUE_600),
                    self._create_summary_card("Experiments", str(data['recent_experiments']['total_recent']), ft.Colors.GREEN_600),
                    self._create_summary_card("Low Stock", str(data['inventory_alerts']['total_low_stock']), ft.Colors.ORANGE_600),
                    self._create_summary_card("Open Findings", str(data['recent_findings']['open_count']), ft.Colors.RED_600),
                ],
                spacing=15
            )
            
            content = ft.Column(
                [
                    header,
                    ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                    summary_cards,
                    ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                    ft.Text(
                        "AI Insights",
                        size=18,
                        weight=ft.FontWeight.BOLD,
                        color=ft.Colors.BLUE_GREY_700
                    ),
                    ft.Container(height=15),
                    ft.Text(
                        f"Most Used Components: {len(data['ai_insights']['most_used_components'])}",
                        size=14,
                        color=ft.Colors.BLUE_GREY_600
                    ),
                    ft.Text(
                        f"Problem Findings: {data['ai_insights']['problem_findings_count']}",
                        size=14,
                        color=ft.Colors.BLUE_GREY_600
                    )
                ],
                spacing=0,
                scroll=ft.ScrollMode.AUTO
            )
            
            return content
            
        except Exception as e:
            return self._create_error_view(f"Error loading dashboard: {str(e)}")
    
    def _create_knowledge_vault_view(self) -> ft.Column:
        """Create the knowledge vault view."""
        header = ft.Row(
            [
                ft.Text("📚", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Knowledge Vault",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Document Repository",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.ElevatedButton(
                    "Upload Document",
                    icon="UPLOAD",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self.page.snack_bar.open = True
                ),
                ft.Container(height=20),
                ft.Text(
                    "Features:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• PDFs, datasheets, images, schematics", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Metadata extraction and indexing", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Search by keyword, project, component", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_notebook_view(self) -> ft.Column:
        """Create the engineering notebook view."""
        header = ft.Row(
            [
                ft.Text("📓", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Engineering Notebook",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Digital Engineering Journal",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.ElevatedButton(
                    "New Entry",
                    icon="ADD",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self.page.snack_bar.open = True
                ),
                ft.Container(height=20),
                ft.Text(
                    "Features:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Rich text and markdown support", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Voice transcription integration", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Image and attachment support", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Project and experiment linking", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_components_view(self) -> ft.Column:
        """Create the component inventory view."""
        header = ft.Row(
            [
                ft.Text("🔧", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Component Inventory",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Component Management",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.ElevatedButton(
                    "Add Component",
                    icon="ADD",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self.page.snack_bar.open = True
                ),
                ft.Container(height=20),
                ft.Text(
                    "Features:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Low-stock warnings", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Search and filtering", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Component history tracking", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Project usage tracking", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_equipment_view(self) -> ft.Column:
        """Create the equipment management view."""
        header = ft.Row(
            [
                ft.Text("⚙️", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Equipment Management",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Equipment Tracking",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.ElevatedButton(
                    "Add Equipment",
                    icon="ADD",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self.page.snack_bar.open = True
                ),
                ft.Container(height=20),
                ft.Text(
                    "Features:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Calibration date tracking", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Maintenance records", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Calibration due reminders", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Maintenance schedule tracking", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_findings_view(self) -> ft.Column:
        """Create the findings and lessons view."""
        header = ft.Row(
            [
                ft.Text("💡", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Findings & Lessons",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Findings Repository",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.ElevatedButton(
                    "Add Finding",
                    icon="ADD",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self.page.snack_bar.open = True
                ),
                ft.Container(height=20),
                ft.Text(
                    "Features:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Discoveries and problems", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Root cause analysis", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Solutions and recommendations", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Project and experiment linking", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_toolbox_view(self) -> ft.Column:
        """Create the engineering toolbox view."""
        header = ft.Row(
            [
                ft.Text("🧮", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Engineering Toolbox",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Calculators & Tools",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.Text(
                    "Electronics:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Ohm's Law Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Voltage Divider Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Power Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• LED Resistor Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Battery Runtime Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Container(height=15),
                ft.Text(
                    "Mathematics:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Matrix Operations", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Statistics", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Curve Fitting", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Scientific Calculator", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_search_view(self) -> ft.Column:
        """Create the AI-powered search view."""
        header = ft.Row(
            [
                ft.Text("🔍", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "AI-Powered Search",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                )
            ],
            spacing=15
        )
        
        search_field = ft.TextField(
            label="Search",
            hint_text="Enter natural language query (e.g., 'Show all projects involving batteries')",
            expand=True
        )
        
        content = ft.Column(
            [
                header,
                ft.Divider(height=30, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Semantic Search",
                    size=16,
                    weight=ft.FontWeight.W_500,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Container(height=15),
                ft.Row(
                    [
                        search_field,
                        ft.ElevatedButton(
                            "Search",
                            icon="SEARCH",
                            bgcolor=ft.Colors.BLUE_600,
                            color=ft.Colors.WHITE,
                            on_click=lambda e: self.page.snack_bar.open = True
                        )
                    ],
                    spacing=10
                ),
                ft.Container(height=20),
                ft.Text(
                    "Example Queries:",
                    size=14,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_700
                ),
                ft.Text("• Show all projects involving lithium batteries", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Find experiments mentioning overheating", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Summarize motor control failures", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• Show all STM32-related work", size=13, color=ft.Colors.BLUE_GREY_600),
                ft.Text("• What lessons have been learned about battery charging?", size=13, color=ft.Colors.BLUE_GREY_600),
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
        
        return content
    
    def _create_summary_card(self, title: str, value: str, color: ft.Colors) -> ft.Container:
        """Create a summary card for the dashboard."""
        return ft.Container(
            content=ft.Column(
                [
                    ft.Text(
                        title,
                        size=12,
                        color=ft.Colors.BLUE_GREY_600
                    ),
                    ft.Text(
                        value,
                        size=28,
                        weight=ft.FontWeight.BOLD,
                        color=color
                    )
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=5
            ),
            bgcolor=ft.Colors.WHITE,
            padding=20,
            border_radius=12,
            border=ft.border.all(1, color.with_opacity(0.3)),
            width=150
        )
    
    def _create_error_view(self, message: str) -> ft.Column:
        """Create an error view."""
        return ft.Column(
            [
                ft.Text("⚠️", size=48, color=ft.Colors.RED_600),
                ft.Container(height=20),
                ft.Text(
                    message,
                    size=14,
                    color=ft.Colors.RED_600
                )
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER
        )
    
    def _on_app_close(self, e) -> None:
        """Cleanup when the app is closed."""
        print("🛑 Cleaning up before app close...")
        
        # Stop voice listener if running
        if self.voice_listener and self.voice_listener.is_active():
            self.voice_listener.stop()
            print("🔇 Voice listener stopped")
        
        # Close database connection
        if self.db:
            self.db.close()
            print("🔌 Database connection closed")
    
    def _load_sample_data(self, e) -> None:
        """Load sample data for analysis (placeholder)."""
        if not self.is_online:
            self.page.snack_bar = ft.SnackBar(
                content=ft.Text("Cannot load data while offline. Please connect to network."),
                bgcolor=ft.Colors.ORANGE_600
            )
            self.page.snack_bar.open = True
            self.page.update()
            return
        
        # Show loading indicator
        self.page.snack_bar = ft.SnackBar(
            content=ft.Text("Loading data from cloud..."),
            bgcolor=ft.Colors.BLUE_600
        )
        self.page.snack_bar.open = True
        self.page.update()
        
        # Simulate data loading
        print("📊 Loading sample data for analysis...")
        
        # In production, this would call the data processor
        # df, stats = self.processor.analyze_file(cloud_url)


def main():
    """Main entry point for the application."""
    ft.run(main=LabApp)


if __name__ == "__main__":
    main()
