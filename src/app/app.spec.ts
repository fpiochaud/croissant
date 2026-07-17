import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { App } from './app';
import { CroissantService } from './croissant.service';

const mockCroissantService = {
  authStatus:      signal('loading' as const),
  activeTab:       signal('rotation' as const),
  state:           signal({
    persons: [], notifPrefs: { eve: false, morning: false, swap: false },
    rules: { auto: true, catch: true, manual: false }, history: [],
    teamName: '', notifications: [], currentIndex: 0, sessionOffset: 0,
  }),
  darkMode:        signal(false),
  syncStatus:      signal('syncing' as const),
  currentUser:     signal(null),
  isAdmin:         signal(false),
  showAddModal:    signal(false),
  showEditModal:   signal(false),
  editPerson:      signal(null),
  personToDelete:  signal(null),
  personToPromote: signal(null),
  promoteBlocked:  signal(false),
  fcmStatus:       signal('idle' as const),
  authError:       signal(null),
  currentUserName: vi.fn(() => ''),
  login:              vi.fn(),
  logout:             vi.fn(),
  openTab:            vi.fn(),
  openAddModal:       vi.fn(),
  openEditModal:      vi.fn(),
  closeModals:        vi.fn(),
  setDarkMode:        vi.fn(),
  setNotifPref:       vi.fn(),
  setSessionOffset:   vi.fn(),
  setRule:            vi.fn(),
  addHistory:         vi.fn(),
  addPerson:          vi.fn(),
  updatePerson:       vi.fn(),
  deletePerson:       vi.fn(),
  setPersonAbsent:    vi.fn(),
  movePersonToTop:    vi.fn(),
  promoteReplacement: vi.fn(),
  initFCM:            vi.fn(),
  removeFCM:          vi.fn(),
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: CroissantService, useValue: mockCroissantService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
