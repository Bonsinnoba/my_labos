import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import TabNavigator from './TabNavigator';
import ProjectDetailScreen from '../screens/Projects/ProjectDetail';
import ExperimentDetailScreen from '../screens/Experiments/ExperimentDetail';
import FindingDetailScreen from '../screens/Findings/FindingDetail';
import PrivacyScreen from '../screens/Settings/PrivacyScreen';
import TermsScreen from '../screens/Settings/TermsScreen';
import HelpScreen from '../screens/Settings/HelpScreen';
import PINSetupScreen from '../screens/Settings/PINSetupScreen';
import SearchScreen from '../screens/Search';
import PINLockScreen from '../screens/Settings/PINLockScreen';
import ResourcesScreen from '../screens/Resources';

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#242424',
        },
        headerTintColor: '#e0e0e0',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        options={{ headerShown: false }}
      >
        {() => (
          <PINLockScreen>
            <TabNavigator />
          </PINLockScreen>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project Details' }}
      />
      <Stack.Screen
        name="ExperimentDetail"
        component={ExperimentDetailScreen}
        options={{ title: 'Experiment Details' }}
      />
      <Stack.Screen
        name="FindingDetail"
        component={FindingDetailScreen}
        options={{ title: 'Finding Details' }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: 'Privacy' }}
      />
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
        options={{ title: 'Terms of Service' }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: 'Help & Support' }}
      />
      <Stack.Screen
        name="PINSetup"
        component={PINSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Stack.Screen
        name="Resources"
        component={ResourcesScreen}
        options={{ title: 'Resources' }}
      />
    </Stack.Navigator>
  );
}
