

  // Ajoute ici les méthodes pour manipuler l'état, synchroniser avec Firebase, etc.

  setNotifPref(pref: keyof AppState['notifPrefs'], value: boolean) {
    this.state.update((s) => ({
      ...s,
      notifPrefs: { ...s.notifPrefs, [pref]: value },
    }));
  }

  addHistory(event: { date: string; type: string; details: any }) {
    this.state.update((s) => ({
      ...s,
      history: [
        { ...event },
        ...s.history,
      ],
    }));
  }

  setPersonAbsent(personId: string) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.map((p) =>
        p.id === personId ? { ...p, status: 'absent' } : p
      ),
    }));
  }

  setPersonOk(personId: string) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.map((p) =>
        p.id === personId ? { ...p, status: 'ok' } : p
      ),
    }));
  }

  setRule(rule: keyof AppState['rules'], value: boolean) {
    this.state.update((s) => ({
      ...s,
      rules: { ...s.rules, [rule]: value },
    }));
  }

  addPerson(data: { name: string; initials: string; color: string }) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const person: Person = {
      id,
      name: data.name,
      initials: data.initials,
      color: data.color,
      status: 'ok',
    };
    this.state.update((s) => ({
      ...s,
      persons: [...s.persons, person],
    }));
  }

  updatePerson(person: Person) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.map((p) => (p.id === person.id ? person : p)),
    }));
  }

  deletePerson(person: Person) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.filter((p) => p.id !== person.id),
    }));
  }
}
      status: 'ok',
    };
    this.state.update((s) => ({
      ...s,
      persons: [...s.persons, person],
    }));
  }

  updatePerson(person: Person) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.map((p) => (p.id === person.id ? person : p)),
    }));
  }

  deletePerson(person: Person) {
    this.state.update((s) => ({
      ...s,
      persons: s.persons.filter((p) => p.id !== person.id),
    }));
  }
}
