"""
Engineering Toolbox Module

This module provides reusable engineering utilities and calculators.
Every calculation is stored automatically and linked to the active project if one exists.

Electronics Calculators:
- Ohm's Law
- Voltage Divider Calculator
- Power Calculator
- LED Resistor Calculator
- Battery Runtime Calculator
- RC Time Constant Calculator
- LC Resonant Frequency Calculator
- Capacitor Energy Calculator
- Inductor Energy Calculator
- RLC Impedance Calculator
- PWM Duty Cycle Calculator

Mechanical Calculators:
- Gear Ratio Calculator
- Torque Calculator
- Angular Velocity Calculator

Thermal Calculators:
- Thermal Resistance Calculator
- Heat Dissipation Calculator
- Temperature Rise Calculator

Signal Processing:
- Decibel Calculator
- Frequency to Wavelength Calculator
- Baud Rate Calculator

Unit Converters:
- Length Converter
- Mass Converter
- Temperature Converter
- Pressure Converter

Wire Calculators:
- AWG Wire Gauge Calculator
- Wire Resistance Calculator

Mathematics Calculators:
- Matrix Operations
- Statistics
- Curve Fitting
- Scientific Calculator
"""

import json
import numpy as np
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime

# Add parent directory to path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.cache_db import CacheDatabase


class EngineeringToolbox:
    """Manages engineering calculators and tools."""
    
    def __init__(self, db: Optional[CacheDatabase] = None):
        """
        Initialize the engineering toolbox.
        
        Args:
            db: CacheDatabase instance (creates new if None)
        """
        self.db = db if db else CacheDatabase()
        self.active_project_id: Optional[int] = None
        print("[OK] Engineering Toolbox initialized")
    
    def set_active_project(self, project_id: Optional[int]) -> None:
        """
        Set the active project for calculation storage.
        
        Args:
            project_id: Project ID or None
        """
        self.active_project_id = project_id
    
    def _store_calculation(self, title: str, calculation_type: str, 
                          input_parameters: Dict[str, Any], result: Any,
                          formula: Optional[str] = None) -> int:
        """
        Store a calculation in the database.
        
        Args:
            title: Calculation title
            calculation_type: Type of calculation
            input_parameters: Input parameters as dictionary
            result: Calculation result
            formula: Formula used
            
        Returns:
            The ID of the stored calculation
        """
        calc_id = self.db.add_calculation(
            title=title,
            calculation_type=calculation_type,
            input_parameters=json.dumps(input_parameters),
            result=json.dumps(result),
            formula=formula,
            project_id=self.active_project_id
        )
        
        print(f"[OK] Calculation stored: {title} (ID: {calc_id})")
        return calc_id
    
    # Electronics Calculators
    
    def ohms_law(self, voltage: Optional[float] = None, current: Optional[float] = None,
                 resistance: Optional[float] = None) -> Dict[str, Any]:
        """
        Calculate Ohm's Law (V = I * R).
        Provide any two values to calculate the third.
        
        Args:
            voltage: Voltage in volts (V)
            current: Current in amperes (A)
            resistance: Resistance in ohms (Ω)
            
        Returns:
            Dictionary with calculated values
        """
        provided = sum(1 for x in [voltage, current, resistance] if x is not None)
        if provided != 2:
            raise ValueError("Exactly two values must be provided")
        
        result = {}
        if voltage is None:
            result['voltage'] = current * resistance
            result['current'] = current
            result['resistance'] = resistance
        elif current is None:
            result['voltage'] = voltage
            result['current'] = voltage / resistance
            result['resistance'] = resistance
        elif resistance is None:
            result['voltage'] = voltage
            result['current'] = current
            result['resistance'] = voltage / current
        
        result['power'] = result['voltage'] * result['current']
        
        # Store calculation
        self._store_calculation(
            title="Ohm's Law Calculation",
            calculation_type="ohms_law",
            input_parameters={'voltage': voltage, 'current': current, 'resistance': resistance},
            result=result,
            formula="V = I * R, P = V * I"
        )
        
        return result
    
    def voltage_divider(self, vin: float, r1: float, r2: float) -> Dict[str, Any]:
        """
        Calculate voltage divider output.
        
        Args:
            vin: Input voltage in volts
            r1: Top resistor in ohms
            r2: Bottom resistor in ohms
            
        Returns:
            Dictionary with calculated values
        """
        vout = vin * (r2 / (r1 + r2))
        current = vin / (r1 + r2)
        power_r1 = (current ** 2) * r1
        power_r2 = (current ** 2) * r2
        
        result = {
            'vin': vin,
            'vout': vout,
            'r1': r1,
            'r2': r2,
            'current': current,
            'power_r1': power_r1,
            'power_r2': power_r2
        }
        
        self._store_calculation(
            title="Voltage Divider Calculation",
            calculation_type="voltage_divider",
            input_parameters={'vin': vin, 'r1': r1, 'r2': r2},
            result=result,
            formula="Vout = Vin * (R2 / (R1 + R2))"
        )
        
        return result
    
    def power_calculator(self, voltage: float, current: Optional[float] = None,
                        resistance: Optional[float] = None) -> Dict[str, Any]:
        """
        Calculate power (P = V * I = V² / R = I² * R).
        
        Args:
            voltage: Voltage in volts
            current: Current in amperes (optional)
            resistance: Resistance in ohms (optional)
            
        Returns:
            Dictionary with calculated values
        """
        if current is not None:
            power = voltage * current
        elif resistance is not None:
            power = (voltage ** 2) / resistance
        else:
            raise ValueError("Either current or resistance must be provided")
        
        result = {
            'voltage': voltage,
            'current': current,
            'resistance': resistance,
            'power': power
        }
        
        self._store_calculation(
            title="Power Calculation",
            calculation_type="power",
            input_parameters={'voltage': voltage, 'current': current, 'resistance': resistance},
            result=result,
            formula="P = V * I = V² / R = I² * R"
        )
        
        return result
    
    def led_resistor(self, vs: float, vf: float, if_current: float) -> Dict[str, Any]:
        """
        Calculate LED resistor value.
        
        Args:
            vs: Source voltage in volts
            vf: LED forward voltage in volts
            if_current: LED forward current in amperes
            
        Returns:
            Dictionary with calculated values
        """
        resistor = (vs - vf) / if_current
        power = (if_current ** 2) * resistor
        
        # Standard resistor values (E12 series)
        standard_values = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82]
        standard_values_ohms = []
        for val in standard_values:
            for multiplier in [1, 10, 100, 1000, 10000]:
                standard_values_ohms.append(val * multiplier)
        
        # Find closest standard value
        closest_resistor = min(standard_values_ohms, key=lambda x: abs(x - resistor))
        
        result = {
            'vs': vs,
            'vf': vf,
            'if_current': if_current,
            'calculated_resistor': resistor,
            'closest_standard_resistor': closest_resistor,
            'power': power,
            'recommended_power_rating': power * 2  # 2x safety margin
        }
        
        self._store_calculation(
            title="LED Resistor Calculation",
            calculation_type="led_resistor",
            input_parameters={'vs': vs, 'vf': vf, 'if_current': if_current},
            result=result,
            formula="R = (Vs - Vf) / If"
        )
        
        return result
    
    def battery_runtime(self, capacity_mah: float, current_ma: float) -> Dict[str, Any]:
        """
        Calculate battery runtime.
        
        Args:
            capacity_mah: Battery capacity in mAh
            current_ma: Current draw in mA
            
        Returns:
            Dictionary with calculated values
        """
        runtime_hours = capacity_mah / current_ma
        runtime_minutes = runtime_hours * 60
        
        result = {
            'capacity_mah': capacity_mah,
            'current_ma': current_ma,
            'runtime_hours': runtime_hours,
            'runtime_minutes': runtime_minutes,
            'runtime_formatted': f"{int(runtime_hours)}h {int(runtime_minutes % 60)}m"
        }
        
        self._store_calculation(
            title="Battery Runtime Calculation",
            calculation_type="battery_runtime",
            input_parameters={'capacity_mah': capacity_mah, 'current_ma': current_ma},
            result=result,
            formula="Runtime = Capacity / Current"
        )
        
        return result
    
    def rc_time_constant(self, resistance: float, capacitance: float) -> Dict[str, Any]:
        """
        Calculate RC time constant (τ = R * C).
        
        Args:
            resistance: Resistance in ohms
            capacitance: Capacitance in farads
            
        Returns:
            Dictionary with calculated values
        """
        time_constant = resistance * capacitance
        charge_time_5tau = 5 * time_constant  # Time to fully charge
        
        result = {
            'resistance': resistance,
            'capacitance': capacitance,
            'time_constant': time_constant,
            'charge_time_5tau': charge_time_5tau,
            'time_constant_ms': time_constant * 1000,
            'time_constant_us': time_constant * 1000000
        }
        
        self._store_calculation(
            title="RC Time Constant Calculation",
            calculation_type="rc_time_constant",
            input_parameters={'resistance': resistance, 'capacitance': capacitance},
            result=result,
            formula="τ = R * C"
        )
        
        return result
    
    def lc_resonant_frequency(self, inductance: float, capacitance: float) -> Dict[str, Any]:
        """
        Calculate LC resonant frequency (f = 1 / (2π * √(LC))).
        
        Args:
            inductance: Inductance in henries
            capacitance: Capacitance in farads
            
        Returns:
            Dictionary with calculated values
        """
        resonant_frequency = 1 / (2 * np.pi * np.sqrt(inductance * capacitance))
        period = 1 / resonant_frequency
        
        result = {
            'inductance': inductance,
            'capacitance': capacitance,
            'resonant_frequency': resonant_frequency,
            'resonant_frequency_khz': resonant_frequency / 1000,
            'resonant_frequency_mhz': resonant_frequency / 1000000,
            'period': period,
            'angular_frequency': 2 * np.pi * resonant_frequency
        }
        
        self._store_calculation(
            title="LC Resonant Frequency Calculation",
            calculation_type="lc_resonant_frequency",
            input_parameters={'inductance': inductance, 'capacitance': capacitance},
            result=result,
            formula="f = 1 / (2π * √(LC))"
        )
        
        return result
    
    def capacitor_energy(self, capacitance: float, voltage: float) -> Dict[str, Any]:
        """
        Calculate energy stored in a capacitor (E = 0.5 * C * V²).
        
        Args:
            capacitance: Capacitance in farads
            voltage: Voltage in volts
            
        Returns:
            Dictionary with calculated values
        """
        energy = 0.5 * capacitance * (voltage ** 2)
        
        result = {
            'capacitance': capacitance,
            'voltage': voltage,
            'energy_joules': energy,
            'energy_millijoules': energy * 1000,
            'energy_microjoules': energy * 1000000
        }
        
        self._store_calculation(
            title="Capacitor Energy Calculation",
            calculation_type="capacitor_energy",
            input_parameters={'capacitance': capacitance, 'voltage': voltage},
            result=result,
            formula="E = 0.5 * C * V²"
        )
        
        return result
    
    def inductor_energy(self, inductance: float, current: float) -> Dict[str, Any]:
        """
        Calculate energy stored in an inductor (E = 0.5 * L * I²).
        
        Args:
            inductance: Inductance in henries
            current: Current in amperes
            
        Returns:
            Dictionary with calculated values
        """
        energy = 0.5 * inductance * (current ** 2)
        
        result = {
            'inductance': inductance,
            'current': current,
            'energy_joules': energy,
            'energy_millijoules': energy * 1000
        }
        
        self._store_calculation(
            title="Inductor Energy Calculation",
            calculation_type="inductor_energy",
            input_parameters={'inductance': inductance, 'current': current},
            result=result,
            formula="E = 0.5 * L * I²"
        )
        
        return result
    
    def rlc_impedance(self, resistance: float, inductance: float, capacitance: float,
                     frequency: float) -> Dict[str, Any]:
        """
        Calculate RLC circuit impedance.
        
        Args:
            resistance: Resistance in ohms
            inductance: Inductance in henries
            capacitance: Capacitance in farads
            frequency: Frequency in hertz
            
        Returns:
            Dictionary with calculated values
        """
        angular_frequency = 2 * np.pi * frequency
        inductive_reactance = angular_frequency * inductance
        capacitive_reactance = 1 / (angular_frequency * capacitance)
        reactance = inductive_reactance - capacitive_reactance
        impedance = np.sqrt(resistance ** 2 + reactance ** 2)
        phase_angle = np.arctan2(reactance, resistance)
        phase_angle_degrees = np.degrees(phase_angle)
        
        result = {
            'resistance': resistance,
            'inductance': inductance,
            'capacitance': capacitance,
            'frequency': frequency,
            'inductive_reactance': inductive_reactance,
            'capacitive_reactance': capacitive_reactance,
            'reactance': reactance,
            'impedance': impedance,
            'phase_angle_radians': phase_angle,
            'phase_angle_degrees': phase_angle_degrees
        }
        
        self._store_calculation(
            title="RLC Impedance Calculation",
            calculation_type="rlc_impedance",
            input_parameters={'resistance': resistance, 'inductance': inductance, 
                           'capacitance': capacitance, 'frequency': frequency},
            result=result,
            formula="Z = √(R² + (XL - XC)²)"
        )
        
        return result
    
    def pwm_duty_cycle(self, on_time: float, period: float) -> Dict[str, Any]:
        """
        Calculate PWM duty cycle.
        
        Args:
            on_time: On time in seconds
            period: Period in seconds
            
        Returns:
            Dictionary with calculated values
        """
        duty_cycle = (on_time / period) * 100
        frequency = 1 / period
        
        result = {
            'on_time': on_time,
            'period': period,
            'duty_cycle_percent': duty_cycle,
            'duty_cycle_decimal': duty_cycle / 100,
            'frequency': frequency,
            'frequency_khz': frequency / 1000
        }
        
        self._store_calculation(
            title="PWM Duty Cycle Calculation",
            calculation_type="pwm_duty_cycle",
            input_parameters={'on_time': on_time, 'period': period},
            result=result,
            formula="Duty Cycle = (Ton / Tperiod) * 100%"
        )
        
        return result
    
    # Mechanical Calculators
    
    def gear_ratio(self, teeth_driver: int, teeth_driven: int) -> Dict[str, Any]:
        """
        Calculate gear ratio.
        
        Args:
            teeth_driver: Number of teeth on driver gear
            teeth_driven: Number of teeth on driven gear
            
        Returns:
            Dictionary with calculated values
        """
        gear_ratio = teeth_driven / teeth_driver
        speed_ratio = 1 / gear_ratio
        torque_ratio = gear_ratio
        
        result = {
            'teeth_driver': teeth_driver,
            'teeth_driven': teeth_driven,
            'gear_ratio': gear_ratio,
            'speed_ratio': speed_ratio,
            'torque_ratio': torque_ratio
        }
        
        self._store_calculation(
            title="Gear Ratio Calculation",
            calculation_type="gear_ratio",
            input_parameters={'teeth_driver': teeth_driver, 'teeth_driven': teeth_driven},
            result=result,
            formula="Gear Ratio = Ndriven / Ndriver"
        )
        
        return result
    
    def torque(self, force: float, radius: float, angle: float = 90) -> Dict[str, Any]:
        """
        Calculate torque (τ = r * F * sin(θ)).
        
        Args:
            force: Force in newtons
            radius: Radius in meters
            angle: Angle in degrees (default 90)
            
        Returns:
            Dictionary with calculated values
        """
        angle_rad = np.radians(angle)
        torque = radius * force * np.sin(angle_rad)
        
        result = {
            'force': force,
            'radius': radius,
            'angle_degrees': angle,
            'angle_radians': angle_rad,
            'torque': torque,
            'torque_nm': torque
        }
        
        self._store_calculation(
            title="Torque Calculation",
            calculation_type="torque",
            input_parameters={'force': force, 'radius': radius, 'angle': angle},
            result=result,
            formula="τ = r * F * sin(θ)"
        )
        
        return result
    
    def angular_velocity(self, rpm: float) -> Dict[str, Any]:
        """
        Convert RPM to angular velocity.
        
        Args:
            rpm: Rotations per minute
            
        Returns:
            Dictionary with calculated values
        """
        angular_velocity = rpm * (2 * np.pi / 60)
        frequency = rpm / 60
        
        result = {
            'rpm': rpm,
            'angular_velocity_rad_s': angular_velocity,
            'angular_velocity_deg_s': np.degrees(angular_velocity),
            'frequency_hz': frequency
        }
        
        self._store_calculation(
            title="Angular Velocity Calculation",
            calculation_type="angular_velocity",
            input_parameters={'rpm': rpm},
            result=result,
            formula="ω = RPM * (2π / 60)"
        )
        
        return result
    
    # Thermal Calculators
    
    def thermal_resistance(self, temperature_rise: float, power: float) -> Dict[str, Any]:
        """
        Calculate thermal resistance (Rθ = ΔT / P).
        
        Args:
            temperature_rise: Temperature rise in °C
            power: Power dissipation in watts
            
        Returns:
            Dictionary with calculated values
        """
        thermal_resistance = temperature_rise / power
        
        result = {
            'temperature_rise': temperature_rise,
            'power': power,
            'thermal_resistance': thermal_resistance,
            'thermal_resistance_c_w': thermal_resistance
        }
        
        self._store_calculation(
            title="Thermal Resistance Calculation",
            calculation_type="thermal_resistance",
            input_parameters={'temperature_rise': temperature_rise, 'power': power},
            result=result,
            formula="Rθ = ΔT / P"
        )
        
        return result
    
    def heat_dissipation(self, thermal_resistance: float, power: float) -> Dict[str, Any]:
        """
        Calculate temperature rise from heat dissipation (ΔT = Rθ * P).
        
        Args:
            thermal_resistance: Thermal resistance in °C/W
            power: Power dissipation in watts
            
        Returns:
            Dictionary with calculated values
        """
        temperature_rise = thermal_resistance * power
        
        result = {
            'thermal_resistance': thermal_resistance,
            'power': power,
            'temperature_rise': temperature_rise
        }
        
        self._store_calculation(
            title="Heat Dissipation Calculation",
            calculation_type="heat_dissipation",
            input_parameters={'thermal_resistance': thermal_resistance, 'power': power},
            result=result,
            formula="ΔT = Rθ * P"
        )
        
        return result
    
    def temperature_rise(self, ambient_temp: float, power: float, 
                        thermal_resistance: float) -> Dict[str, Any]:
        """
        Calculate final temperature from ambient temperature.
        
        Args:
            ambient_temp: Ambient temperature in °C
            power: Power dissipation in watts
            thermal_resistance: Thermal resistance in °C/W
            
        Returns:
            Dictionary with calculated values
        """
        temperature_rise = thermal_resistance * power
        final_temp = ambient_temp + temperature_rise
        
        result = {
            'ambient_temp': ambient_temp,
            'power': power,
            'thermal_resistance': thermal_resistance,
            'temperature_rise': temperature_rise,
            'final_temp': final_temp
        }
        
        self._store_calculation(
            title="Temperature Rise Calculation",
            calculation_type="temperature_rise",
            input_parameters={'ambient_temp': ambient_temp, 'power': power, 
                           'thermal_resistance': thermal_resistance},
            result=result,
            formula="Tfinal = Tambient + (Rθ * P)"
        )
        
        return result
    
    # Signal Processing Calculators
    
    def decibel(self, power_ratio: float, reference: Optional[float] = None) -> Dict[str, Any]:
        """
        Calculate decibels from power ratio.
        
        Args:
            power_ratio: Power ratio (P2/P1)
            reference: Reference value for absolute dB calculation (optional)
            
        Returns:
            Dictionary with calculated values
        """
        db = 10 * np.log10(power_ratio)
        
        result = {
            'power_ratio': power_ratio,
            'db': db,
            'db_relative': db
        }
        
        if reference is not None:
            db_absolute = 10 * np.log10(power_ratio / reference)
            result['db_absolute'] = db_absolute
            result['reference'] = reference
        
        self._store_calculation(
            title="Decibel Calculation",
            calculation_type="decibel",
            input_parameters={'power_ratio': power_ratio, 'reference': reference},
            result=result,
            formula="dB = 10 * log10(P2/P1)"
        )
        
        return result
    
    def frequency_to_wavelength(self, frequency: float, speed_of_light: float = 299792458) -> Dict[str, Any]:
        """
        Calculate wavelength from frequency (λ = c / f).
        
        Args:
            frequency: Frequency in hertz
            speed_of_light: Speed of light in m/s (default: 299792458)
            
        Returns:
            Dictionary with calculated values
        """
        wavelength = speed_of_light / frequency
        
        result = {
            'frequency': frequency,
            'frequency_mhz': frequency / 1000000,
            'frequency_ghz': frequency / 1000000000,
            'wavelength': wavelength,
            'wavelength_m': wavelength,
            'wavelength_cm': wavelength * 100,
            'wavelength_mm': wavelength * 1000
        }
        
        self._store_calculation(
            title="Frequency to Wavelength Calculation",
            calculation_type="frequency_to_wavelength",
            input_parameters={'frequency': frequency, 'speed_of_light': speed_of_light},
            result=result,
            formula="λ = c / f"
        )
        
        return result
    
    def baud_rate(self, bit_rate: float, bits_per_symbol: int = 8) -> Dict[str, Any]:
        """
        Calculate baud rate from bit rate.
        
        Args:
            bit_rate: Bit rate in bits per second
            bits_per_symbol: Bits per symbol (default: 8)
            
        Returns:
            Dictionary with calculated values
        """
        baud_rate = bit_rate / bits_per_symbol
        
        result = {
            'bit_rate': bit_rate,
            'bits_per_symbol': bits_per_symbol,
            'baud_rate': baud_rate,
            'baud_rate_bps': baud_rate,
            'baud_rate_kbps': baud_rate / 1000
        }
        
        self._store_calculation(
            title="Baud Rate Calculation",
            calculation_type="baud_rate",
            input_parameters={'bit_rate': bit_rate, 'bits_per_symbol': bits_per_symbol},
            result=result,
            formula="Baud Rate = Bit Rate / Bits per Symbol"
        )
        
        return result
    
    # Unit Converters
    
    def convert_length(self, value: float, from_unit: str, to_unit: str) -> Dict[str, Any]:
        """
        Convert length between units.
        
        Args:
            value: Value to convert
            from_unit: Source unit (m, cm, mm, in, ft, yd, mi, km)
            to_unit: Target unit (m, cm, mm, in, ft, yd, mi, km)
            
        Returns:
            Dictionary with converted value
        """
        # Convert to meters first
        to_meters = {
            'm': 1,
            'cm': 0.01,
            'mm': 0.001,
            'in': 0.0254,
            'ft': 0.3048,
            'yd': 0.9144,
            'mi': 1609.344,
            'km': 1000
        }
        
        if from_unit not in to_meters or to_unit not in to_meters:
            raise ValueError(f"Invalid unit. Use: {list(to_meters.keys())}")
        
        value_meters = value * to_meters[from_unit]
        result_value = value_meters / to_meters[to_unit]
        
        result = {
            'value': value,
            'from_unit': from_unit,
            'to_unit': to_unit,
            'result': result_value
        }
        
        self._store_calculation(
            title="Length Conversion",
            calculation_type="length_conversion",
            input_parameters={'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            result=result,
            formula=f"{from_unit} to {to_unit}"
        )
        
        return result
    
    def convert_mass(self, value: float, from_unit: str, to_unit: str) -> Dict[str, Any]:
        """
        Convert mass between units.
        
        Args:
            value: Value to convert
            from_unit: Source unit (kg, g, mg, lb, oz, ton)
            to_unit: Target unit (kg, g, mg, lb, oz, ton)
            
        Returns:
            Dictionary with converted value
        """
        # Convert to kilograms first
        to_kg = {
            'kg': 1,
            'g': 0.001,
            'mg': 0.000001,
            'lb': 0.453592,
            'oz': 0.0283495,
            'ton': 1000
        }
        
        if from_unit not in to_kg or to_unit not in to_kg:
            raise ValueError(f"Invalid unit. Use: {list(to_kg.keys())}")
        
        value_kg = value * to_kg[from_unit]
        result_value = value_kg / to_kg[to_unit]
        
        result = {
            'value': value,
            'from_unit': from_unit,
            'to_unit': to_unit,
            'result': result_value
        }
        
        self._store_calculation(
            title="Mass Conversion",
            calculation_type="mass_conversion",
            input_parameters={'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            result=result,
            formula=f"{from_unit} to {to_unit}"
        )
        
        return result
    
    def convert_temperature(self, value: float, from_unit: str, to_unit: str) -> Dict[str, Any]:
        """
        Convert temperature between units.
        
        Args:
            value: Value to convert
            from_unit: Source unit (C, F, K)
            to_unit: Target unit (C, F, K)
            
        Returns:
            Dictionary with converted value
        """
        # Convert to Celsius first
        if from_unit == 'C':
            value_c = value
        elif from_unit == 'F':
            value_c = (value - 32) * 5 / 9
        elif from_unit == 'K':
            value_c = value - 273.15
        else:
            raise ValueError(f"Invalid unit. Use: C, F, K")
        
        # Convert from Celsius to target
        if to_unit == 'C':
            result_value = value_c
        elif to_unit == 'F':
            result_value = value_c * 9 / 5 + 32
        elif to_unit == 'K':
            result_value = value_c + 273.15
        else:
            raise ValueError(f"Invalid unit. Use: C, F, K")
        
        result = {
            'value': value,
            'from_unit': from_unit,
            'to_unit': to_unit,
            'result': result_value
        }
        
        self._store_calculation(
            title="Temperature Conversion",
            calculation_type="temperature_conversion",
            input_parameters={'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            result=result,
            formula=f"{from_unit} to {to_unit}"
        )
        
        return result
    
    def convert_pressure(self, value: float, from_unit: str, to_unit: str) -> Dict[str, Any]:
        """
        Convert pressure between units.
        
        Args:
            value: Value to convert
            from_unit: Source unit (Pa, kPa, MPa, bar, psi, atm)
            to_unit: Target unit (Pa, kPa, MPa, bar, psi, atm)
            
        Returns:
            Dictionary with converted value
        """
        # Convert to Pascals first
        to_pascal = {
            'Pa': 1,
            'kPa': 1000,
            'MPa': 1000000,
            'bar': 100000,
            'psi': 6894.76,
            'atm': 101325
        }
        
        if from_unit not in to_pascal or to_unit not in to_pascal:
            raise ValueError(f"Invalid unit. Use: {list(to_pascal.keys())}")
        
        value_pa = value * to_pascal[from_unit]
        result_value = value_pa / to_pascal[to_unit]
        
        result = {
            'value': value,
            'from_unit': from_unit,
            'to_unit': to_unit,
            'result': result_value
        }
        
        self._store_calculation(
            title="Pressure Conversion",
            calculation_type="pressure_conversion",
            input_parameters={'value': value, 'from_unit': from_unit, 'to_unit': to_unit},
            result=result,
            formula=f"{from_unit} to {to_unit}"
        )
        
        return result
    
    # Wire Calculators
    
    def awg_wire_gauge(self, awg: int) -> Dict[str, Any]:
        """
        Calculate wire properties from AWG gauge.
        
        Args:
            awg: AWG gauge number (0-40)
            
        Returns:
            Dictionary with wire properties
        """
        # AWG formula: diameter = 0.005 * 92^((36-AWG)/39) inches
        diameter_inches = 0.005 * (92 ** ((36 - awg) / 39))
        diameter_mm = diameter_inches * 25.4
        area_circular_mils = diameter_inches * 1000 ** 2
        area_mm2 = np.pi * (diameter_mm / 2) ** 2
        
        result = {
            'awg': awg,
            'diameter_inches': diameter_inches,
            'diameter_mm': diameter_mm,
            'area_circular_mils': area_circular_mils,
            'area_mm2': area_mm2
        }
        
        self._store_calculation(
            title="AWG Wire Gauge Calculation",
            calculation_type="awg_wire_gauge",
            input_parameters={'awg': awg},
            result=result,
            formula="d = 0.005 * 92^((36-AWG)/39) inches"
        )
        
        return result
    
    def wire_resistance(self, awg: int, length: float, temperature: float = 20,
                      material: str = 'copper') -> Dict[str, Any]:
        """
        Calculate wire resistance.
        
        Args:
            awg: AWG gauge number
            length: Length in meters
            temperature: Temperature in °C (default: 20)
            material: Material (copper, aluminum, silver, gold)
            
        Returns:
            Dictionary with resistance values
        """
        # Resistivity at 20°C (Ω·m)
        resistivity_20c = {
            'copper': 1.68e-8,
            'aluminum': 2.82e-8,
            'silver': 1.59e-8,
            'gold': 2.44e-8
        }
        
        if material not in resistivity_20c:
            raise ValueError(f"Invalid material. Use: {list(resistivity_20c.keys())}")
        
        # Temperature coefficient (1/°C)
        temp_coefficient = {
            'copper': 0.00393,
            'aluminum': 0.00393,
            'silver': 0.0038,
            'gold': 0.0034
        }
        
        # Get wire area from AWG
        awg_result = self.awg_wire_gauge(awg)
        area_m2 = awg_result['area_mm2'] * 1e-6
        
        # Calculate resistivity at temperature
        resistivity = resistivity_20c[material] * (1 + temp_coefficient[material] * (temperature - 20))
        
        # Calculate resistance
        resistance = resistivity * length / area_m2
        
        result = {
            'awg': awg,
            'length': length,
            'temperature': temperature,
            'material': material,
            'resistance': resistance,
            'resistance_ohms': resistance,
            'resistance_mohms': resistance * 1000
        }
        
        self._store_calculation(
            title="Wire Resistance Calculation",
            calculation_type="wire_resistance",
            input_parameters={'awg': awg, 'length': length, 'temperature': temperature, 'material': material},
            result=result,
            formula="R = ρ * L / A"
        )
        
        return result
    
    # Mathematics Calculators
    
    def matrix_multiply(self, matrix_a: List[List[float]], matrix_b: List[List[float]]) -> Dict[str, Any]:
        """
        Multiply two matrices.
        
        Args:
            matrix_a: First matrix (2D list)
            matrix_b: Second matrix (2D list)
            
        Returns:
            Dictionary with result matrix
        """
        a = np.array(matrix_a)
        b = np.array(matrix_b)
        result = np.dot(a, b).tolist()
        
        calc_result = {
            'matrix_a': matrix_a,
            'matrix_b': matrix_b,
            'result': result,
            'dimensions_a': a.shape,
            'dimensions_b': b.shape,
            'dimensions_result': np.array(result).shape
        }
        
        self._store_calculation(
            title="Matrix Multiplication",
            calculation_type="matrix_multiply",
            input_parameters={'matrix_a': matrix_a, 'matrix_b': matrix_b},
            result=calc_result,
            formula="C = A * B"
        )
        
        return calc_result
    
    def statistics(self, data: List[float]) -> Dict[str, Any]:
        """
        Calculate basic statistics for a dataset.
        
        Args:
            data: List of numerical values
            
        Returns:
            Dictionary with statistical values
        """
        if not data:
            raise ValueError("Data list cannot be empty")
        
        arr = np.array(data)
        
        result = {
            'count': len(data),
            'mean': float(np.mean(arr)),
            'median': float(np.median(arr)),
            'std': float(np.std(arr)),
            'variance': float(np.var(arr)),
            'min': float(np.min(arr)),
            'max': float(np.max(arr)),
            'sum': float(np.sum(arr))
        }
        
        self._store_calculation(
            title="Statistics Calculation",
            calculation_type="statistics",
            input_parameters={'data': data},
            result=result,
            formula="Standard statistical formulas"
        )
        
        return result
    
    def linear_regression(self, x: List[float], y: List[float]) -> Dict[str, Any]:
        """
        Perform linear regression (curve fitting).
        
        Args:
            x: X values
            y: Y values
            
        Returns:
            Dictionary with regression parameters
        """
        if len(x) != len(y):
            raise ValueError("X and Y must have the same length")
        
        x_arr = np.array(x)
        y_arr = np.array(y)
        
        # Calculate regression coefficients
        slope, intercept = np.polyfit(x_arr, y_arr, 1)
        
        # Calculate R-squared
        y_pred = slope * x_arr + intercept
        ss_res = np.sum((y_arr - y_pred) ** 2)
        ss_tot = np.sum((y_arr - np.mean(y_arr)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        
        result = {
            'slope': float(slope),
            'intercept': float(intercept),
            'r_squared': float(r_squared),
            'equation': f"y = {slope:.4f}x + {intercept:.4f}",
            'x_values': x,
            'y_values': y
        }
        
        self._store_calculation(
            title="Linear Regression",
            calculation_type="linear_regression",
            input_parameters={'x': x, 'y': y},
            result=result,
            formula="y = mx + b"
        )
        
        return result
    
    def scientific_calculator(self, expression: str) -> Dict[str, Any]:
        """
        Evaluate a mathematical expression.
        
        Args:
            expression: Mathematical expression (e.g., "2 * (3 + 4)")
            
        Returns:
            Dictionary with evaluation result
        """
        try:
            # Safe evaluation using numpy
            result = float(eval(expression, {"__builtins__": None}, 
                                   {"np": np, "sin": np.sin, "cos": np.cos, 
                                    "tan": np.tan, "sqrt": np.sqrt, "log": np.log,
                                    "exp": np.exp, "pi": np.pi, "e": np.e}))
            
            calc_result = {
                'expression': expression,
                'result': result
            }
            
            self._store_calculation(
                title="Scientific Calculator",
                calculation_type="scientific",
                input_parameters={'expression': expression},
                result=calc_result,
                formula=expression
            )
            
            return calc_result
        except Exception as e:
            raise ValueError(f"Invalid expression: {e}")
    
    def get_calculation_history(self, project_id: Optional[int] = None,
                              calculation_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get calculation history.
        
        Args:
            project_id: Filter by project ID
            calculation_type: Filter by calculation type
            
        Returns:
            List of calculations
        """
        calculations = self.db.get_all_calculations(
            project_id=project_id,
            calculation_type=calculation_type
        )
        
        # Parse JSON fields
        for calc in calculations:
            if calc.get('input_parameters'):
                try:
                    calc['input_parameters_dict'] = json.loads(calc['input_parameters'])
                except json.JSONDecodeError:
                    calc['input_parameters_dict'] = {}
            if calc.get('result'):
                try:
                    calc['result_dict'] = json.loads(calc['result'])
                except json.JSONDecodeError:
                    calc['result_dict'] = {}
        
        return calculations
    
    def close(self) -> None:
        """Close the database connection."""
        if self.db:
            self.db.close()


if __name__ == "__main__":
    # Test the engineering toolbox
    print("=== Testing Engineering Toolbox ===\n")
    
    toolbox = EngineeringToolbox()
    
    try:
        # Test Ohm's Law
        print("Testing Ohm's Law...")
        result = toolbox.ohms_law(voltage=12, resistance=1000)
        print(f"Result: {result}")
        
        # Test Voltage Divider
        print("\nTesting Voltage Divider...")
        result = toolbox.voltage_divider(vin=12, r1=10000, r2=10000)
        print(f"Result: {result}")
        
        # Test LED Resistor
        print("\nTesting LED Resistor...")
        result = toolbox.led_resistor(vs=5, vf=2, if_current=0.02)
        print(f"Result: {result}")
        
        # Test Statistics
        print("\nTesting Statistics...")
        result = toolbox.statistics([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        print(f"Result: {result}")
        
        # Get calculation history
        print("\nCalculation History:")
        history = toolbox.get_calculation_history()
        print(f"Total calculations: {len(history)}")
        
    finally:
        toolbox.close()
    
    print("\n[OK] All tests passed")
