def teaching(classes_taught, total_classes):
    """
    Calculate the percentage of classes taught.
    classes include all, lectures, practicals, lab sessions, tutorials etc
    Args:
        classes_taught (int): The number of classes taught.
        total_classes (int): The total number of classes.

    Returns:
        str: The teaching performance category.
    """
    if total_classes == 0:
        grade = 0
    else:
        grade = (classes_taught / total_classes) * 100
    
    if grade >= 80:
        return 'good'
    elif grade >= 70:
        return 'satisfactory'
    else:
        return 'not satisfactory'

def Activity_Score():
    """Involvement in the
university /college
student related
activities /research
activities :
(a) Administrative
responsibilities
such as head,
chairperson/
Dean
/Director/ Coordinator,
warden etc. (b) Examination and evaluation
duties assigned by the
college / university or
attending the examination
paper evaluation.
(c) Student related co-curricular,
extension and field based
activities such as student
clubs, career counseling,
study visits, student
seminars and other events,
cultural, sports, NCC, NSS
and community services.
(d) Organization seminars /
conference /workshop, other
college /university activities.
(e) Evidence of activity involved
in guiding PhD students.
(f) Conducting minor or major
research project
(g) Sponsored by national or
international agencies.
At least one single or joint
publication in peer-reviewed or
UGC list of journals. """

    if no_of_activities >= 3:
        return 'Good'
    elif 1 > no_of_activities < 2:
        return 'Satisfactory'
    else:
        return 'Not Satisfactory'


#All done for Table 1

#Now for Table 2

def research_scoring(papers=0, intl_books=0, nat_books=0):
    #if Published Research Papers in Peer-Reviewed or UGC listed Journals score = +8
    if Research_papers == 'Yes':
        score += 8
    if International_publisher == 'Yes':
        score += 12
    if National_publisher == 'Yes':
        score += 10
    if Chapter_in_Edited_Book == 'Yes':
        score += 5
    if Editor_of_Book_by_International_Publisher == 'Yes':
        score += 10
    if Editor_of_Book_by_National_Publisher == 'Yes':
        score += 8
    if Translation_in_Chapter_or_Research_Paper == 'Yes':
        score += 3
    if Translation_in_Book == 'Yes':
        score += 8

    return score

def research_guidance():
    score = 0
    if PhD_degree_awarded== 'Yes':
        score += 10
    if PhD_thesis_submitted == 'Yes':
        score += 5
    if MPhil_or_PG_dissertation_awarded == 'Yes':
        score += 2
    
    if research_consultancy == 'Yes':
        score += 3
    
    if research_project_completed == 'Yes':
        if amount > 1000000:
            score += 10
        else:
            score += 5
    if research_project_ongoing == 'Yes':
        if amount > 1000000:
            score += 5
        else:
            score += 2

def  patents():
    if patents_filed == 'Yes':
        if international_level == 'Yes':
            score += 10
        if national_level == 'Yes':
            score += 7

    if policy_document == 'Yes':
        if national_level == 'Yes':
            score += 7
        if international_level == 'Yes':
            score += 10
        if state_level == 'Yes':
            score += 4
    
    if Awards_or_fellowship == 'Yes':
        if international_level == 'Yes':
            score += 7
        if national_level == 'Yes':
            score += 5

    return score

def presented_papers():
    if presented == 'Yes':
        if international_level_abroad == 'Yes':
            score += 7
        if national_level == 'Yes':
            score += 3
        if state_level == 'Yes':
            score += 2
        if international_level_india == 'Yes':
            score += 5
    return score

def pedagogy_creation():
    if developed_innovative_pedagogy == 'Yes':
        score += 5
    if designed_new_curriculum == 'Yes':
        score += 2
    if MOOCs == 'Yes':
        if complete_course_in_4_quadrants == 'Yes':
            score += 20
        if content_writer == 'Yes':
            score += 2
        if course_coordinator == 'Yes':
            score += 8
        if per_lecture_moocs == 'Yes':
            score += 5
    if e_content == 'Yes':
        if complete_course_in_4_quadrants == 'Yes':
            score += 12
        if editor_of_e_content == 'Yes':
            score += 10
        if contributor == 'Yes':
            score += 2
        if content_per_module == 'Yes':
            score += 5
    return score