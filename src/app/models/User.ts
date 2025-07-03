import { Request } from './Request';
import { Message } from './Message';
import constants from 'src/app/helpers/constants';

type RequestEnum = 'requesting' | 'requested';

interface UserSubscription {
  id: string;
  expireDate: Date;
}



export class User {

  public _id: string;
  private _firstName: string;
  private _lastName: string;
  private _email: string;
  private _birthDate: Date | null;
  private _gender: string;
  private _address: string;
  private _aboutMe: string;
  private _avatar: string[];
  private _mainAvatar: string;
  private _isFriend: boolean;
  private _status: string;
  private _education: string;
  private _profession: string;
  private _school: string;
  private _interests: string[];
  private _country: string;
  private _city: string;
  private _followed: boolean;
  private _friend: boolean;
  private _request: RequestEnum | null;
  private _requests: Request[];
  public _online: boolean;
  private _messages: Message[];
  private _subscription: UserSubscription | null;
  private _randomVisible: boolean;
  private _ageVisible: boolean;
  private _loggedIn: boolean;
  private _visitProfile: boolean;
  private _profileCreated: boolean;
  private _enabled: boolean;
  private _is2FAEnabled: boolean;
  private _twoFAToken: string;
  private _role: string;
  private _banned: boolean;
  private _reports: any[];
  private _followers: any[];
  private _following: any[];
  private _friends: any[];
  private _blockedUsers: any[];
  private _followedChannels: any[];
  private _messagedUsers: any[];
  private _deletedAt: Date | null;
  private _createdAt: Date | null;
  private _updatedAt: Date | null;
  private _salt: string;
  private _hashed_password: string;
  private _lastSeen: Date | null;  // <-- New property added here
  private _peerId: string | null;  // ✅ Add peerId property
  public _lastSeenText: string | null;

  constructor(
    id: string = '',
    firstName: string = '',
    lastName: string = '',
    email: string = '',
    birthDate: Date | null = null,
    gender: string = 'Not specified',
    address: string = '',
    aboutMe: string = '',
    avatar: string[] = [],
    mainAvatar: string = '',
    status: string = '',
    education: string = 'Undefined',
    profession: string = 'Undefined',
    school: string = 'Undefined',
    interests: string[] = [],
    country: string = '',
    city: string = '',
    followed: boolean = false,
    friend: boolean = false,
    isFriend: boolean = false,
    request: RequestEnum | null = null,
    requests: Request[] = [],
    online: boolean = false,
    messages: Message[] = [],
    subscription: UserSubscription | null = null,
    randomVisible: boolean = false,
    ageVisible: boolean = false,
    loggedIn: boolean = false,
    visitProfile: boolean = false,
    profileCreated: boolean = false,
    enabled: boolean = false,
    is2FAEnabled: boolean = false,
    twoFAToken: string = '',
    role: string = '',
    banned: boolean = false,
    reports: any[] = [],
    followers: any[] = [],
    following: any[] = [],
    friends: any[] = [],
    blockedUsers: any[] = [],
    followedChannels: any[] = [],
    messagedUsers: any[] = [],
    deletedAt: Date | null = null,
    createdAt: Date | null = null,
    updatedAt: Date | null = null,
    salt: string = '',
    hashed_password: string = '',
    lastSeen: Date | null = null,  // <-- Initialize lastSeen here
    peerId: string | null = null,  // ✅ Add peerId to constructor
    lastSeenText: string | null = null,

  ) {
    this._id = id;
    this._firstName = firstName;
    this._lastName = lastName;
    this._email = email;
    this._birthDate = birthDate;
    this._gender = gender;
    this._address = address;
    this._aboutMe = aboutMe;
    this.avatar = avatar;
    this._mainAvatar = mainAvatar;
    this._status = status;
    this._education = education;
    this._profession = profession;
    this._school = school;
    this._interests = interests;
    this._country = country;
    this._city = city;
    this._followed = followed;
    this._friend = friend;
    this._isFriend = isFriend;
    this._request = request;
    this._requests = requests;
    this._online = online;
    this._messages = messages;
    this._subscription = subscription;
    this._randomVisible = randomVisible;
    this._ageVisible = ageVisible;
    this._loggedIn = loggedIn;
    this._visitProfile = visitProfile;
    this._profileCreated = profileCreated;
    this._enabled = enabled;
    this._is2FAEnabled = is2FAEnabled;
    this._twoFAToken = twoFAToken;
    this._role = role;
    this._banned = banned;
    this._reports = reports;
    this._followers = followers;
    this._following = following;
    this._friends = friends;
    this._blockedUsers = blockedUsers;
    this._followedChannels = followedChannels;
    this._messagedUsers = messagedUsers;
    this._deletedAt = deletedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._salt = salt;
    this._hashed_password = hashed_password;
    this._lastSeen = lastSeen;  // <-- Assign lastSeen here
    this._peerId = peerId;  // ✅ Assign peerId
    this._lastSeenText = lastSeenText;

  }

  // Getter methods
  get id(): string { return this._id; }
  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get fullName(): string { return `${this._firstName} ${this._lastName}`; }
  get email(): string { return this._email; }
  get gender(): string { return this._gender; }
  get birthDate(): Date | null { return this._birthDate; }
  get address(): string { return this._address; }
  get status(): string { return this._status; }
  get avatar(): string[] { return this._avatar; }
  get mainAvatar(): string {
    return this._mainAvatar ? this.constructAvatarUrl(this._mainAvatar) : this.getDefaultAvatar(this._gender);
  }
  
  get aboutMe(): string { return this._aboutMe; }
  get lastSeen(): Date | null { return this._lastSeen; }  // <-- Add a getter for lastSeen

  get friends(): any[] { return this._friends; }
  set friends(friends: any[]) { this._friends = friends; }

  get isFriend(): boolean { return this._isFriend; }
  set isFriend(isFriend: boolean) { this._isFriend = isFriend; }
  set lastSeen(lastSeen: Date | null) { this._lastSeen = lastSeen; }  // <-- Add a setter for lastSeen

  get education(): string { return this._education; }
  get profession(): string { return this._profession; }
  get school(): string { return this._school; }
  get interests(): string[] { return this._interests; }
  get city(): string { return this._city; }
  get country(): string { return this._country; }
  get followed(): boolean { return this._followed; }
  get friend(): boolean { return this._friend; }
  get request(): RequestEnum | null { return this._request; }
  get online(): boolean { return this._online; }
  get messages(): Message[] { return this._messages; }
  get requests(): Request[] { return this._requests; }
  get subscription(): UserSubscription | null { return this._subscription; }
  get randomVisible(): boolean { return this._randomVisible; }
  get ageVisible(): boolean { return this._ageVisible; }
  get loggedIn(): boolean { return this._loggedIn; }
  get visitProfile(): boolean { return this._visitProfile; }

  get lastSeenText(): string | null { return this._lastSeenText; }
  set lastSeenText(lastSeenText: string | null) { this._lastSeenText = lastSeenText; }
  
  
  public getPeerId(): string | null {
    return this._peerId;
}

  // ✅ Setter for peerId
public setPeerId(peerId: string | null): void {
    console.log(`🔄 Setting Peer ID: ${peerId}`);
    this._peerId = peerId;
}
get peerId(): string | null {
  return this._peerId;
}

// ✅ Setter for Peer ID
set peerId(peerId: string | null) {
  this._peerId = peerId;
}
  // Setter methods
  set id(id: string) { this._id = id; }
  set firstName(firstName: string) { this._firstName = firstName; }
  set lastName(lastName: string) { this._lastName = lastName; }
  set email(email: string) { this._email = email; }
  set birthDate(birthDate: Date | null) { this._birthDate = birthDate; }
  set gender(gender: string) { this._gender = gender; }
  set address(address: string) { this._address = address; }
  set avatar(avatars: any) {
    if (Array.isArray(avatars)) {
      this._avatar = avatars.map((avatar: string) => this.constructAvatarUrl(avatar));
    } else {
      this._avatar = [];
    }
  }

  set mainAvatar(mainAvatar: string) { this._mainAvatar = mainAvatar; }

  set status(status: string) { this._status = status; }
  set education(education: string) { this._education = education; }
  set profession(profession: string) { this._profession = profession; }
  set school(school: string) { this._school = school; }
  set country(country: string) { this._country = country; }
  set aboutMe(aboutMe: string) { this._aboutMe = aboutMe; }

  set city(city: string) { this._city = city; }
  set interests(interests: string[]) {
    this._interests = interests.filter(interest => interest.trim().length > 0);
    this.sortInterests();
  }
  set followed(followed: boolean) { this._followed = followed; }
  set friend(friend: boolean) { this._friend = friend; }
  set request(request: RequestEnum | null) { this._request = request; }
  set online(online: boolean) { this._online = online; }
  set messages(messages: Message[]) { this._messages = messages; }
  set profileCreated(profileCreated: boolean) { this._profileCreated = profileCreated; }
  set requests(requests: Request[]) {
    this._requests = requests.map(req => new Request().initialize(req));
  }
  set subscription(subscription: UserSubscription | null) {
    this._subscription = subscription;
  }
  set randomVisible(randomVisible: boolean) { this._randomVisible = randomVisible; }
  set ageVisible(ageVisible: boolean) { this._ageVisible = ageVisible; }
  set loggedIn(loggedIn: boolean) { this._loggedIn = loggedIn; }
  set visitProfile(visitProfile: boolean) { this._visitProfile = visitProfile; }

  private constructAvatarUrl(avatarPath: string): string {
    if (!avatarPath) {
      return `${constants.DOMAIN_URL}/uploads/default-avatar.png`; // Default avatar URL
    }
    if (avatarPath.startsWith('data:image')) {

      return avatarPath; // Return as is if it is already a base64 image
    }
    if (avatarPath.startsWith('http')) {

      return avatarPath; // Return as is if it is already a complete URL
    }
    return `${constants.DOMAIN_URL}${avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`}`;
  }

  public getMainAvatar(): string {
    if (this._mainAvatar) {
      return this._mainAvatar.startsWith('http') ? this._mainAvatar : `${constants.DOMAIN_URL}${this._mainAvatar}`;
    }
    return this.getDefaultAvatar(this._gender);
  }



  private getDefaultAvatar(gender: string): string {
    switch (gender) {
      case 'male':
        return `${constants.DOMAIN_URL}/public/images/avatars/male.webp`; // Replace with actual male default avatar URL
      case 'female':
        return `${constants.DOMAIN_URL}/public/images/avatars/female.webp`; // Replace with actual female default avatar URL
      default:
        return `${constants.DOMAIN_URL}/public/images/avatars/other.webp`; // Replace with actual other default avatar URL
    }
  }

  public getId(): string {
    return this._id;
  }

  

  public getAge(isLoggedInUser: boolean): number | null {
  //  console.log('loggedIn:', isLoggedInUser);
  //  console.log('ageVisible:', this._ageVisible);
   // console.log('birthDate:', this._birthDate);

    // If it's the logged-in user's profile, always return the age, otherwise check ageVisible
    if ((!this._ageVisible && !isLoggedInUser) || !this._birthDate) {
     ///   console.log('Returning null - either age is not visible or birth date is missing.');
        return null;
    }

    const today = new Date();
    const birthDate = new Date(this._birthDate);
 //   console.log('Today\'s Date:', today);
  //  console.log('Birth Date:', birthDate);

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--; // Adjust age if the birthday hasn't occurred yet this year
    }

   // console.log('Final Age:', age);
    return age;
}

  
  
  private isValidUserData(user: any): boolean {
    const requiredFields = [
      '_id', 'firstName', 'lastName', 'email', 'birthDate', 'gender'
    ];

    const missingFields = requiredFields.filter(field => !(field in user));
    if (missingFields.length > 0) {
      console.warn('Missing fields in user data:', missingFields);
      return false;
    }
    return true;
  }

  initialize(user: any): User {
   // console.log('Initializing user:', user);

    if (!user || typeof user !== 'object') {
      console.error('Invalid user data:', user);
      throw new Error('Invalid user data');
    }
    console.log('⚠️ Received raw user data from backend:', user);

    this._id = user._id || '';
    this._firstName = user.firstName || '';
    this._lastName = user.lastName || '';
    this._email = user.email || '';
    this._birthDate = user.birthDate ? new Date(user.birthDate) : null;
    this._gender = user.gender || 'Not specified';
    this._address = user.address || '';
    this._aboutMe = user.aboutMe || '';
    this.avatar = Array.isArray(user.avatar) ? this.filterCustomAvatars(user.avatar, user.gender) : [];
    this._mainAvatar = user.mainAvatar || this.getDefaultAvatar(this._gender);
    this._status = user.status || '';
    this._education = user.education || 'Undefined';
    this._profession = user.profession || 'Undefined';
    this._school = user.school || 'Undefined';
    this._interests = Array.isArray(user.interests) ? (user.interests.length ? user.interests : ['No Interests']) : ['No Interests'];
    this._country = user.country || '';
    this._city = user.city || '';
    this._followed = !!user.followed;
    this._friend = !!user.friend;
    this._isFriend = user.isFriend === undefined ? !!user.friend : !!user.isFriend;
    this._request = user.request || null;
    this._requests = Array.isArray(user.requests) ? user.requests.map((req: any) => new Request().initialize(req)) : [];
    this._online = !!user.online;
    this._messages = Array.isArray(user.messages) ? user.messages.map((msg: any) => new Message().initialize(msg)) : [];
    this._subscription = user.subscription ? {
      id: user.subscription.id,
      expireDate: user.subscription.expireDate ? new Date(user.subscription.expireDate) : null
    } : null;
    this._randomVisible = user.randomVisible || false;
    this._ageVisible = !!user.ageVisible;
    this._loggedIn = !!user.loggedIn;
    this._visitProfile = user.visitProfile ?? false;
    this._profileCreated = !!user.profileCreated;
    this._enabled = !!user.enabled;
    this._is2FAEnabled = !!user.is2FAEnabled;
    this._twoFAToken = user.twoFAToken || '';
    this._role = user.role || 'USER';
    this._banned = !!user.banned;
    this._reports = Array.isArray(user.reports) ? user.reports : [];
    this._followers = Array.isArray(user.followers) ? user.followers : [];
    this._following = Array.isArray(user.following) ? user.following : [];
    this._friends = Array.isArray(user.friends) ? user.friends : [];
    this._blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
    this._followedChannels = Array.isArray(user.followedChannels) ? user.followedChannels : [];
    this._messagedUsers = Array.isArray(user.messagedUsers) ? user.messagedUsers : [];
    this._deletedAt = user.deletedAt ? new Date(user.deletedAt) : null;
    this._createdAt = user.createdAt ? new Date(user.createdAt) : null;
    this._updatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
    this._salt = user.salt || '';
    this._hashed_password = user.hashed_password || '';
    this._lastSeen = user.lastSeen ? new Date(user.lastSeen) : null;  // <-- Initialize lastSeen here
    this._lastSeenText = user.lastSeenText || null;

    this._peerId = user.peerId || null;  // ✅ Assign peerId
    console.log('✅ After initialization, lastSeenText:', this.lastSeenText);
    console.log('✅ After initialization, full User object:', this.toObject());

    if (!this._profileCreated) {
      this._profileCreated = true;
    }

    if (this._interests.length) {
      this.sortInterests();
    }

    //('User initialized successfully:', this.toObject());

    return this;
  }

  private filterCustomAvatars(avatars: string[], gender: string): string[] {
    const defaultAvatar = this.getDefaultAvatar(gender);
    const normalizedDefaultAvatar = this.normalizeAvatarPath(defaultAvatar);
  
    return avatars.filter(avatar => {
      const normalizedAvatar = this.normalizeAvatarPath(avatar);
      console.log(`Comparing normalizedAvatar: ${normalizedAvatar} with normalizedDefaultAvatar: ${normalizedDefaultAvatar}`);
      return normalizedAvatar !== normalizedDefaultAvatar;
    });
  }
  
  
  
  private normalizeAvatarPath(avatarPath: string): string {
    console.log("avatarpath in normalizeAvatarPath:", avatarPath);
  
    // Normalize the path by removing the domain and any '/public' prefix
    try {
      const url = new URL(avatarPath);
      avatarPath = url.pathname; // Extract the path from the URL
    } catch (e) {
      // If it's not a full URL, assume it's already a relative path
    }
  
    // Remove the '/public' prefix if it exists to standardize paths
    if (avatarPath.startsWith('/public')) {
      avatarPath = avatarPath.replace('/public', '');
    }
  
    return avatarPath;
  }
  
  
  
  
  private sortInterests(): void {
    this._interests.sort((a, b) => a.length - b.length);
  }

  toObject(): any {
    return {
      _id: this._id,
      firstName: this._firstName,
      lastName: this._lastName,
      email: this._email,
      birthDate: this._birthDate,
      gender: this._gender,
      address: this._address,
      avatar: this._avatar,
      mainAvatar: this._mainAvatar,
      status: this._status,
      education: this._education,
      profession: this._profession,
      school: this._school,
      interests: this._interests,
      country: this._country,
      city: this._city,
      online: this._online,
      lastSeen: this._lastSeen,  // <-- Include lastSeen in the object returned
      subscription: this._subscription ? {
        id: this._subscription.id,
        expireDate: this._subscription.expireDate
      } : null,
      randomVisible: this._randomVisible,
      ageVisible: this._ageVisible,
      loggedIn: this._loggedIn,
      visitProfile: this._visitProfile,
      profileCreated: this._profileCreated,
      enabled: this._enabled,
      is2FAEnabled: this._is2FAEnabled,
      twoFAToken: this._twoFAToken,
      role: this._role,
      banned: this._banned,
      reports: this._reports,
      followers: this._followers,
      following: this._following,
      friends: this._friends,
      isFriend: this._isFriend,
      blockedUsers: this._blockedUsers,
      followedChannels: this._followedChannels,
      messagedUsers: this._messagedUsers,
      messages: this._messages,
      deletedAt: this._deletedAt,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      salt: this._salt,
      peerId: this._peerId,  // ✅ Include peerId
      hashed_password: this._hashed_password,
      aboutMe: this._aboutMe, // Added aboutMe field
      lastSeenText: this._lastSeenText,

    };
  }
}
