"""
Project View Module

This module provides the Flet UI component for managing and tracking lab projects.
It displays projects in a card layout and allows viewing project details, logs,
 and analytical data.
"""

import flet as ft
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase
from database import queries


class ProjectView:
    """Manages the project management UI."""
    
    def __init__(self, page: ft.Page, db: CacheDatabase, 
                 on_project_selected: Optional[Callable] = None):
        """
        Initialize the project view.
        
        Args:
            page: Flet page object
            db: CacheDatabase instance
            on_project_selected: Callback when a project is selected
        """
        self.page = page
        self.db = db
        self.on_project_selected = on_project_selected
        self.selected_project: Optional[Dict[str, Any]] = None
        self.projects: List[Dict[str, Any]] = []
        
        # UI components
        self.project_cards: List[ft.Card] = []
        self.project_list: Optional[ft.ListView] = None
        self.detail_panel: Optional[ft.Container] = None
        
        # Load projects
        self._load_projects()
    
    def _load_projects(self) -> None:
        """Load all projects from the database."""
        try:
            self.projects = self.db.get_all_projects()
            print(f"✅ Loaded {len(self.projects)} projects")
        except Exception as e:
            print(f"❌ Error loading projects: {e}")
            self.projects = []
    
    def _get_status_color(self, status: str) -> ft.Colors:
        """
        Get color based on project status.
        
        Args:
            status: Project status string
            
        Returns:
            Flet color
        """
        status_lower = status.lower()
        if status_lower == "active":
            return ft.Colors.GREEN_600
        elif status_lower == "completed":
            return ft.Colors.BLUE_600
        elif status_lower == "paused":
            return ft.Colors.ORANGE_600
        else:
            return ft.Colors.GREY_600
    
    def _get_status_badge(self, status: str) -> ft.Container:
        """
        Create a status badge container.
        
        Args:
            status: Project status string
            
        Returns:
            Container with status badge
        """
        color = self._get_status_color(status)
        return ft.Container(
            content=ft.Text(
                status,
                size=11,
                weight=ft.FontWeight.BOLD,
                color=color
            ),
            bgcolor=color.with_opacity(0.1),
            padding=12,
            border_radius=12
        )
    
    def _create_project_card(self, project: Dict[str, Any]) -> ft.Card:
        """
        Create a card for a single project.
        
        Args:
            project: Project dictionary
            
        Returns:
            Card component
        """
        # Get log count
        log_count = queries.get_project_logs_count(project['name'], db=self.db)
        
        card = ft.Card(
            content=ft.Container(
                content=ft.Column(
                    [
                        # Header with name and status
                        ft.Row(
                            [
                                ft.Text(
                                    "🔬",
                                    size=24,
                                    color=ft.Colors.BLUE_600
                                ),
                                ft.Container(
                                    content=ft.Text(
                                        project['name'],
                                        size=16,
                                        weight=ft.FontWeight.BOLD,
                                        color=ft.Colors.BLUE_GREY_800
                                    ),
                                    expand=True
                                ),
                                self._get_status_badge(project['status'])
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                        ),
                        ft.Container(height=12),
                        # Description
                        ft.Text(
                            project.get('description', 'No description'),
                            size=13,
                            color=ft.Colors.BLUE_GREY_600,
                            max_lines=2,
                            overflow=ft.TextOverflow.ELLIPSIS
                        ),
                        ft.Container(height=12),
                        # Footer with stats
                        ft.Row(
                            [
                                ft.Text(
                                    "📄",
                                    size=16,
                                    color=ft.Colors.GREY_500
                                ),
                                ft.Text(
                                    f"{log_count} log{'s' if log_count != 1 else ''}",
                                    size=12,
                                    color=ft.Colors.GREY_600
                                ),
                                ft.Container(width=20),
                                ft.Text(
                                    "📅",
                                    size=16,
                                    color=ft.Colors.GREY_500
                                ),
                                ft.Text(
                                    project.get('start_date', 'N/A'),
                                    size=12,
                                    color=ft.Colors.GREY_600
                                )
                            ]
                        )
                    ],
                    spacing=0
                ),
                padding=16
            ),
            elevation=2,
            on_click=lambda e, p=project: self._on_project_click(p)
        )
        
        return card
    
    def _on_project_click(self, project: Dict[str, Any]) -> None:
        """
        Handle project card click.
        
        Args:
            project: Selected project dictionary
        """
        self.selected_project = project
        print(f"📂 Selected project: {project['name']}")
        
        # Update detail panel
        self._update_detail_panel(project)
        
        # Call callback if provided
        if self.on_project_selected:
            self.on_project_selected(project)
        
        self.page.update()
    
    def _update_detail_panel(self, project: Dict[str, Any]) -> None:
        """
        Update the detail panel with project information.
        
        Args:
            project: Project dictionary
        """
        # Get project summary
        summary = queries.get_project_summary(project['name'], db=self.db)
        
        if not summary:
            return
        
        # Build log list
        log_items = []
        for log in summary['logs'][:5]:  # Show first 5 logs
            log_items.append(
                ft.ListTile(
                    leading=ft.Text(
                        "📝",
                        color=ft.Colors.BLUE_600,
                        size=24
                    ),
                    title=ft.Text(
                        log['title'],
                        size=14,
                        weight=ft.FontWeight.W_500
                    ),
                    subtitle=ft.Text(
                        log['text'][:100] + "..." if len(log['text']) > 100 else log['text'],
                        size=12,
                        color=ft.Colors.BLUE_GREY_600
                    )
                )
            )
        
        # Update detail panel content
        self.detail_panel.content = ft.Column(
            [
                # Project header
                ft.Row(
                    [
                        ft.Text(
                            "🔬",
                            size=32,
                            color=ft.Colors.BLUE_600
                        ),
                        ft.Container(
                            content=ft.Column(
                                [
                                    ft.Text(
                                        project['name'],
                                        size=20,
                                        weight=ft.FontWeight.BOLD,
                                        color=ft.Colors.BLUE_GREY_800
                                    ),
                                    self._get_status_badge(project['status'])
                                ],
                                spacing=8
                            ),
                            expand=True
                        ),
                        ft.IconButton(
                            icon="✖",
                            on_click=self._close_detail_panel
                        )
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN
                ),
                ft.Divider(height=1, color=ft.Colors.BLUE_GREY_200),
                ft.Container(height=20),
                # Project info
                ft.Column(
                    [
                        ft.Text(
                            "Description",
                            size=12,
                            weight=ft.FontWeight.BOLD,
                            color=ft.Colors.BLUE_GREY_700
                        ),
                        ft.Text(
                            project.get('description', 'No description'),
                            size=13,
                            color=ft.Colors.BLUE_GREY_600
                        ),
                        ft.Container(height=16),
                        ft.Text(
                            "Start Date",
                            size=12,
                            weight=ft.FontWeight.BOLD,
                            color=ft.Colors.BLUE_GREY_700
                        ),
                        ft.Text(
                            project.get('start_date', 'N/A'),
                            size=13,
                            color=ft.Colors.BLUE_GREY_600
                        ),
                        ft.Container(height=16),
                        ft.Text(
                            "Key Findings",
                            size=12,
                            weight=ft.FontWeight.BOLD,
                            color=ft.Colors.BLUE_GREY_700
                        ),
                        ft.Text(
                            project.get('summary_findings', 'No findings summary yet'),
                            size=13,
                            color=ft.Colors.BLUE_GREY_600
                        )
                    ],
                    spacing=0
                ),
                ft.Container(height=20),
                ft.Divider(height=1, color=ft.Colors.BLUE_GREY_200),
                ft.Container(height=20),
                # Logs section
                ft.Row(
                    [
                        ft.Text(
                            f"Research Logs ({summary['total_logs']})",
                            size=14,
                            weight=ft.FontWeight.BOLD,
                            color=ft.Colors.BLUE_GREY_700
                        ),
                        ft.Container(expand=True),
                        ft.TextButton(
                            "View All",
                            on_click=lambda e: print("View all logs")
                        )
                    ]
                ),
                ft.Container(height=12),
                ft.Column(
                    log_items if log_items else [ft.Text("No logs yet", color=ft.Colors.GREY_500)],
                    spacing=4
                )
            ],
            spacing=0,
            scroll=ft.ScrollMode.AUTO
        )
    
    def _close_detail_panel(self, e) -> None:
        """Close the detail panel."""
        self.selected_project = None
        self.detail_panel.content = ft.Column(
            [
                ft.Text(
                    "📂",
                    size=48,
                    color=ft.Colors.GREY_400
                ),
                ft.Container(height=16),
                ft.Text(
                    "Select a project to view details",
                    size=14,
                    color=ft.Colors.GREY_600
                )
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER
        )
        self.page.update()
    
    def _create_project_list(self) -> ft.ListView:
        """
        Create the project list view.
        
        Returns:
            ListView with project cards
        """
        self.project_cards = []
        
        for project in self.projects:
            card = self._create_project_card(project)
            self.project_cards.append(card)
        
        return ft.ListView(
            controls=self.project_cards,
            spacing=12,
            padding=8
        )
    
    def _create_detail_panel(self) -> ft.Container:
        """
        Create the detail panel container.
        
        Returns:
            Container for project details
        """
        self.detail_panel = ft.Container(
            content=ft.Column(
                [
                    ft.Icon(
                        name=ft.icons.FOLDER_OPEN,
                        size=48,
                        color=ft.Colors.GREY_400
                    ),
                    ft.Container(height=16),
                    ft.Text(
                        "Select a project to view details",
                        size=14,
                        color=ft.Colors.GREY_600
                    )
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER
            ),
            bgcolor=ft.Colors.WHITE,
            border=ft.border.all(1, ft.Colors.BLUE_GREY_200),
            border_radius=8,
            padding=20,
            expand=True
        )
        
        return self.detail_panel
    
    def build(self) -> ft.Row:
        """
        Build the complete project view.
        
        Returns:
            Row with project list and detail panel
        """
        # Create header
        header = ft.Row(
            [
                ft.Text("📁", size=28, color=ft.Colors.BLUE_600),
                ft.Text(
                    "Projects",
                    size=24,
                    weight=ft.FontWeight.BOLD,
                    color=ft.Colors.BLUE_GREY_800
                ),
                ft.Container(expand=True),
                ft.ElevatedButton(
                    "New Project",
                    icon="+",
                    bgcolor=ft.Colors.BLUE_600,
                    color=ft.Colors.WHITE,
                    on_click=self._show_new_project_dialog
                )
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN
        )
        
        # Create main content
        content = ft.Column(
            [
                header,
                ft.Container(height=20),
                ft.Row(
                    [
                        # Project list (left side)
                        ft.Container(
                            content=self._create_project_list(),
                            expand=True,
                            bgcolor=ft.Colors.GREY_50,
                            border_radius=8,
                            padding=12
                        ),
                        ft.Container(width=16),
                        # Detail panel (right side)
                        ft.Container(
                            content=self._create_detail_panel(),
                            width=400,
                            expand=False
                        )
                    ],
                    expand=True
                )
            ],
            spacing=0,
            expand=True
        )
        
        return content
    
    def _show_new_project_dialog(self, e) -> None:
        """Show dialog to create a new project."""
        name_field = ft.TextField(
            label="Project Name",
            hint_text="Enter project name",
            autofocus=True
        )
        
        description_field = ft.TextField(
            label="Description",
            hint_text="Enter project description",
            multiline=True,
            max_lines=3
        )
        
        status_dropdown = ft.Dropdown(
            label="Status",
            options=[
                ft.dropdown.Option("Active"),
                ft.dropdown.Option("Paused"),
                ft.dropdown.Option("Completed")
            ],
            value="Active"
        )
        
        def on_create(dialog, e):
            """Handle project creation."""
            name = name_field.value.strip()
            description = description_field.value.strip()
            status = status_dropdown.value
            
            if not name:
                name_field.error_text = "Project name is required"
                self.page.update()
                return
            
            try:
                project_id = queries.add_project(
                    name=name,
                    description=description if description else None,
                    status=status,
                    db=self.db
                )
                
                # Reload projects
                self._load_projects()
                
                # Rebuild the view
                new_content = self.build()
                # Update the parent container (would need to be passed in)
                
                dialog.open = False
                self.page.snack_bar = ft.SnackBar(
                    content=ft.Text(f"Project '{name}' created successfully!"),
                    bgcolor=ft.Colors.GREEN_600
                )
                self.page.snack_bar.open = True
                self.page.update()
                
            except Exception as ex:
                self.page.snack_bar = ft.SnackBar(
                    content=ft.Text(f"Error creating project: {str(ex)}"),
                    bgcolor=ft.Colors.RED_600
                )
                self.page.snack_bar.open = True
                self.page.update()
        
        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Create New Project"),
            content=ft.Column(
                [
                    name_field,
                    ft.Container(height=12),
                    description_field,
                    ft.Container(height=12),
                    status_dropdown
                ],
                tight=True,
                width=400
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda d, e: setattr(d, 'open', False) or self.page.update()),
                ft.ElevatedButton(
                    "Create",
                    on_click=lambda d, e: on_create(d, e)
                )
            ],
            actions_alignment=ft.MainAxisAlignment.END
        )
        
        self.page.dialog = dialog
        dialog.open = True
        self.page.update()
    
    def refresh(self) -> None:
        """Refresh the project list."""
        self._load_projects()
        # Rebuild the view (would need to be called from parent)
